'use client';

import Api from './Api';
import { REVIEW_API } from './endpoint';

export interface ReviewMediaItem {
  type: 'image' | 'video';
  url: string;
  name?: string;
}

export interface ReviewInput {
  productId: number;
  rating: number;
  title: string;
  content: string;
  media?: ReviewMediaItem[];
  tags?: string[];
}

export default class ReviewApi {
  static async getEligibility(productId: number): Promise<{ canReview: boolean; reason?: string } | undefined> {
    try {
      const response = await Api.get(REVIEW_API.GET_ELIGIBILITY(productId));
      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  static async uploadMedia(files: File[]): Promise<ReviewMediaItem[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    const response = await Api.post(REVIEW_API.UPLOAD_MEDIA, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data?.data || response.data || [];
  }

  static async createReview(input: ReviewInput): Promise<boolean> {
    try {
      await Api.post(REVIEW_API.CREATE_REVIEW, input);
      return true;
    } catch (error) {
      return false;
    }
  }
}
