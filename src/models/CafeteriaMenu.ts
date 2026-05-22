import mongoose, { Document, Schema } from 'mongoose';

export interface IMenuItem {
    name: string;
    price: string;
    imageUrl?: string;
}

export interface IDailyMeal {  
    time: string; // 조식, 중식, 석
    menus: IMenuItem[] 
}

export interface ICafeteriaMenu extends Document {
    cafeteriaId: string;
    cafeteriaName: string;    
    weekStartDate: string;
    date: string;
    fetchedAt: Date;
    meals: IDailyMeal[];
}

const MenuItemSchema = new Schema<IMenuItem> (
    {
    name: { type: String, required: true },
    price: {type: String, required: true },
    imageUrl: { type: String },
    }, 
    { _id: false }
)   

const DailyMealSchema = new Schema<IDailyMeal> (
    {
    time: { type: String, required: true },
    menus: { type: [MenuItemSchema], required: true },
    },
    { _id: false }
)


const CafeteriaMenuSchema: Schema = new Schema(
    {
        cafeteriaId: { type: String, required: true },
        cafeteriaName: { type: String, required: true },
        weekStartDate: { type: String, required: true },
        date: { type: String, required: true },
        fetchedAt: { type: Date, required: true },
        meals: { type: [DailyMealSchema], required: true },
    },
    { timestamps: true },
)

CafeteriaMenuSchema.index({ date: 1, cafeteriaId: 1}, { unique: true });

export default mongoose.model<ICafeteriaMenu>('CafeteriaMenu', CafeteriaMenuSchema);
