// Mongoose Schema that will store our docuemnt hashes and status

import mongoose, { Document, Schema } from 'mongoose';

export interface IIngestionRegistry extends Document {
    documentId: string;
    fileName: string;
    docHash: string;
    chunkCount: number;
    status: 'SUCCESS' | 'FAILED';  
}


const IngestionRegistrySchema: Schema = new Schema(
    {
    documentId: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    docHash: { type: String, required: true },
    chunkCount: { type: Number, required: true },
    status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IIngestionRegistry>('IngestionRegistry', IngestionRegistrySchema);
