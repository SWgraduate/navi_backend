import mongoose, { Document, Model, Schema } from 'mongoose';
import {
  ACADEMIC_ORGANIZATION_NODE_TYPES,
  AcademicOrganizationNodeType,
} from 'src/services/DepartmentTreeScraper';

export interface IAcademicOrganizationNode extends Document {
  sourceKey: string;
  sourceUrl?: string;
  nodeKey: string;
  parentKey: string | null;
  label: string;
  type: AcademicOrganizationNodeType;
  path: string[];
  depth: number;
  sortOrder: number;
  url?: string;
  fetchedAt: Date;
}

const AcademicOrganizationNodeSchema = new Schema<IAcademicOrganizationNode>(
  {
    sourceKey: { type: String, required: true, index: true },
    sourceUrl: { type: String, required: false },
    nodeKey: { type: String, required: true },
    parentKey: { type: String, required: false, default: null },
    label: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ACADEMIC_ORGANIZATION_NODE_TYPES,
    },
    path: { type: [String], required: true },
    depth: { type: Number, required: true },
    sortOrder: { type: Number, required: true },
    url: { type: String, required: false },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

AcademicOrganizationNodeSchema.index(
  { sourceKey: 1, nodeKey: 1 },
  { unique: true },
);
AcademicOrganizationNodeSchema.index({ sourceKey: 1, parentKey: 1, sortOrder: 1 });

const AcademicOrganizationNode: Model<IAcademicOrganizationNode> =
  mongoose.models.AcademicOrganizationNode ||
  mongoose.model<IAcademicOrganizationNode>(
    'AcademicOrganizationNode',
    AcademicOrganizationNodeSchema,
  );

export default AcademicOrganizationNode;
