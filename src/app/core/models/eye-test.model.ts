export interface EyeReading {
  sphere?: number;
  cylinder?: number;
  axis?: number;
  add?: number;
}

export interface EyeTest {
  _id: string;
  customer: string;
  rightEye: EyeReading;
  leftEye: EyeReading;
  pupillaryDistance?: number;
  testedBy: string | { _id: string; name: string };
  testedAt: string;
  nextCheckupDue?: string;
  notes?: string;
}

export interface CreateEyeTestPayload {
  customer: string;
  rightEye: EyeReading;
  leftEye: EyeReading;
  pupillaryDistance?: number;
  nextCheckupDue?: string;
  notes?: string;
}
