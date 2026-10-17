import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. 'aiConfig'
    value: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const Setting = mongoose.model('Setting', settingSchema);
export default Setting;
