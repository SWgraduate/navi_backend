import mongoose, { Schema, InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

export type User = InferSchemaType<typeof UserSchema>;

export const UserModel = mongoose.model<User>('User', UserSchema);
