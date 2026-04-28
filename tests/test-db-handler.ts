import mongoose from 'mongoose';
import { MONGO_URI, NODE_ENV } from 'src/settings';

// 모든 모델을 임포트하여 Mongoose에 등록되도록 함
import 'src/models/User';
import 'src/models/Student';
import 'src/models/AcademicRecord';
import 'src/models/Verification';
import 'src/models/Chat';
import 'src/models/IngestionRegistry';

/**
 * 테스트용 MongoDB URI의 안전성을 검증합니다.
 * - URI 내의 DB 이름에 반드시 'test' 또는 'local' 문자열이 포함되어야 함.
 * - 'main' 또는 'develop' 키워드가 포함되어 있고, 'test' 식별자가 없으면 위험으로 간주.
 */
export const validateTestMongoURI = (uri: string): void => {
  const lowerUri = uri.toLowerCase();
  
  // 1. NODE_ENV가 test가 아니면 즉시 중단
  if (NODE_ENV !== 'test') {
    throw new Error(`CRITICAL: Attempted to run tests in non-test environment (NODE_ENV=${NODE_ENV})`);
  }

  // 2. 운영/개발용 키워드 포함 여부 검사 (가장 강력한 보호)
  const isProductionKeywords = lowerUri.includes('/main') || lowerUri.includes('/develop');
  const isRemoteCluster = lowerUri.includes('mongodb+srv');
  const hasTestIdentifier = lowerUri.includes('test') || lowerUri.includes('local') || lowerUri.includes('127.0.0.1') || lowerUri.includes('localhost');

  if (isRemoteCluster && !lowerUri.includes('test')) {
    throw new Error(
      `CRITICAL: Remote MongoDB Atlas Cluster detected in test environment! Remote clusters are NOT allowed for safety. URI: ${uri}`
    );
  }

  if (isProductionKeywords && !lowerUri.includes('test')) {
    throw new Error(
      `CRITICAL: Unsafe Database URI detected! URI contains production/development keywords ('main' or 'develop') but lacks 'test' identifier. URI: ${uri}`
    );
  }

  // 3. 최소한의 안전장치: test, local, 127.0.0.1 중 하나는 포함되어야 함
  if (!hasTestIdentifier) {
    throw new Error(
      `CRITICAL: Database URI is not recognized as a test database. It must contain 'test', 'local', or be a local loopback address: ${uri}`
    );
  }
};

/**
 * 테스트 데이터베이스에 연결하고 인덱스를 생성합니다.
 */
export const connectTestDB = async (): Promise<void> => {
  validateTestMongoURI(MONGO_URI);

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(MONGO_URI);

  // 모든 모델의 인덱스 생성을 보장하여 테스트 안정성 확보
  await Promise.all(
    mongoose.modelNames().map(modelName => mongoose.model(modelName).createIndexes())
  );
};

/**
 * 데이터베이스를 삭제하고 연결을 종료합니다.
 * 삭제 전 다시 한번 안전성을 검증합니다.
 */
export const closeAndDropTestDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    // 삭제 전 마지막 안전 검증
    validateTestMongoURI(MONGO_URI);
    
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

/**
 * 모든 컬렉션의 데이터를 초기화합니다. (beforeEach/afterEach 용)
 */
export const clearTestData = async (): Promise<void> => {
  await Promise.all(
    mongoose.modelNames().map(modelName => mongoose.model(modelName).deleteMany({}))
  );
};
