import * as cheerio from 'cheerio';
import axios from 'axios';
import CafeteriaMenu, { ICafeteriaMenu, IDailyMeal, IMenuItem } from 'src/models/CafeteriaMenu';
import { logger } from 'src/utils/log';

const CAFETERIA_NAMES: Record<string, string> = {
  re11: '교직원식당',
  re12: '학생식당',
  re13: '창의인재원식당',
  re14: '푸드코트',
  re15: '창업보육센터',
};

const BASE_URL = 'https://www.hanyang.ac.kr';
const PORTLET_ID = 'kr_ac_hanyang_cafe_web_portlet_CafePortlet';

export class CampusLifeService {
  private static instance: CampusLifeService;

  public static getInstance(): CampusLifeService {
    if (!CampusLifeService.instance) {
      CampusLifeService.instance = new CampusLifeService();
    }
    return CampusLifeService.instance;
  }

  /**
   * 오늘의 메뉴를 반환합니다.
   * DB에 이번 주 데이터가 있으면 즉시 반환, 없으면 크롤링 후 저장합니다.
   */
  public async getTodayMenu(cafeteriaId: string = 're12'): Promise<ICafeteriaMenu | null> {
    const today = this.formatDate(new Date());
    const weekStart = this.getWeekStartDate();

    const cached = await CafeteriaMenu.findOne({ date: today, cafeteriaId });
    if (cached) {
      logger.i(`CampusLifeService: DB cache hit (${cafeteriaId}, ${today})`);
      return cached;
    }

    logger.i(`CampusLifeService: Cache miss → 이번 주 전체 크롤링 시작 (${cafeteriaId})`);
    await this.crawlAndCacheWeek(cafeteriaId, weekStart);

    return CafeteriaMenu.findOne({ date: today, cafeteriaId });
  }

  /**
   * 이번 주 전체(월~일) 메뉴를 크롤링하여 DB에 저장합니다.
   * 이전 주 데이터는 삭제합니다.
   */
  private async crawlAndCacheWeek(cafeteriaId: string, weekStartDate: string): Promise<void> {
    // 이전 주 데이터 삭제
    const deleted = await CafeteriaMenu.deleteMany({
      cafeteriaId,
      weekStartDate: { $ne: weekStartDate },
    });
    if (deleted.deletedCount > 0) {
      logger.i(`CampusLifeService: 이전 주 데이터 ${deleted.deletedCount}건 삭제 (${cafeteriaId})`);
    }

    // 월(i=0) ~ 일(i=6) 7일치 순서대로 크롤링
    for (let i = 0; i < 7; i++) {
      const date = this.addDays(weekStartDate, i);
      await this.crawlAndCacheDay(cafeteriaId, date, weekStartDate);
    }
  }

  /**
   * 특정 날짜의 dailyView를 크롤링하여 DB에 저장합니다.
   * dailyView에는 메뉴 텍스트, 가격, 이미지 URL이 모두 포함됩니다.
   */
  private async crawlAndCacheDay(cafeteriaId: string, date: string, weekStartDate: string): Promise<void> {
    try {
      const dateParam = date.replace(/-/g, '%2F');
      const url = `${BASE_URL}/web/www/${cafeteriaId}?p_p_id=${PORTLET_ID}&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_${PORTLET_ID}_sMenuDate=${dateParam}&_${PORTLET_ID}_action=view`;

      const response = await axios.get(url, {
        headers: {
          'Accept': 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      const meals: IDailyMeal[] = [];

      // dailyView 안의 h3.hyu-element = 조식 / 중식 / 석식 시간대 구분자
      $(`#_${PORTLET_ID}_dailyView > h3.hyu-element`).each((_: number, elem: any) => {
        const time = $(elem).text().trim();
        const menus: IMenuItem[] = [];

        $(elem).next('.hyu-list-container').find('.menu-thumbnail').each((_: number, menuElem: any) => {
          const name = $(menuElem).find('.menu-detail p').text().trim();
          const price = $(menuElem).find('.menu-price h3').text().trim();

          // CSS background-image 스타일에서 이미지 URL 추출
          // 예: style="background: url('https://www.hanyang.ac.kr/documents/...')"
          const style = $(menuElem).find('.menu-img').attr('style') ?? '';
          const match = style.match(/url\(['"]?(.*?)['"]?\)/);
          const imageUrl = match?.[1];

          if (name) {
            menus.push({ name, price, ...(imageUrl && { imageUrl }) });
          }
        });

        if (menus.length > 0) {
          meals.push({ time, menus });
        }
      });

      if (meals.length === 0) {
        logger.d(`CampusLifeService: 메뉴 없음 - ${cafeteriaId} / ${date} (주말 또는 미등록)`);
        return;
      }

      await CafeteriaMenu.findOneAndUpdate(
        { date, cafeteriaId },
        {
          cafeteriaId,
          cafeteriaName: CAFETERIA_NAMES[cafeteriaId] ?? cafeteriaId,
          date,
          weekStartDate,
          meals,
          fetchedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      logger.s(`CampusLifeService: 저장 완료 - ${cafeteriaId} / ${date} (${meals.length}개 시간대)`);
    } catch (error) {
      logger.e(`CampusLifeService: 크롤링 실패 - ${cafeteriaId} / ${date}`, error);
    }
  }

  // ─── 헬퍼 메서드 ─────────────────────────────────────────────────────────────

  // 오늘 날짜 기준으로 이번 주 월요일을 'YYYY-MM-DD'로 반환
  private getWeekStartDate(): string {
    const today = new Date();
    const day = today.getDay(); // 0=일, 1=월 ... 6=토
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - diff);
    return this.formatDate(monday);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!; // 'YYYY-MM-DDTHH:...' → 'YYYY-MM-DD'
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return this.formatDate(date);
  }
}
