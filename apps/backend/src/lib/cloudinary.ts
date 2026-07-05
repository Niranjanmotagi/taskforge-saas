import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/config/env';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface UploadResult {
  url: string;
  publicId: string;
  thumbnailUrl: string | null;
  sizeBytes: number;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

/** Upload a buffer (from multer memory storage) to Cloudinary. */
export function uploadBuffer(
  buffer: Buffer,
  options: { workspaceId: string; filename: string; mimeType: string }
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const isImage = options.mimeType.startsWith('image/');
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.CLOUDINARY_FOLDER}/${options.workspaceId}`,
        resource_type: 'auto',
        filename_override: options.filename,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          thumbnailUrl: isImage
            ? cloudinary.url(result.public_id, {
                width: 320,
                height: 320,
                crop: 'fill',
                format: 'webp',
                secure: true,
              })
            : null,
          sizeBytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' as never });
}

export { cloudinary };
