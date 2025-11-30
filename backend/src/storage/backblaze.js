import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import {
  BACKBLAZE_APPLICATION_KEY,
  BACKBLAZE_BUCKET_NAME,
  BACKBLAZE_ENDPOINT,
  BACKBLAZE_KEY_ID,
  BACKBLAZE_PUBLIC_BASE_URL,
  BACKBLAZE_REGION,
} from '../config.js';

const defaultEndpoint = BACKBLAZE_REGION
  ? `https://s3.${BACKBLAZE_REGION}.backblazeb2.com`
  : undefined;

const publicBaseUrl = (BACKBLAZE_PUBLIC_BASE_URL || `${BACKBLAZE_BUCKET_NAME ? `https://${BACKBLAZE_BUCKET_NAME}.s3.${BACKBLAZE_REGION}.backblazeb2.com` : ''}`).replace(/\/$/, '');

const s3Client = new S3Client({
  region: BACKBLAZE_REGION,
  endpoint: BACKBLAZE_ENDPOINT || defaultEndpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: BACKBLAZE_KEY_ID,
    secretAccessKey: BACKBLAZE_APPLICATION_KEY,
  },
});

function ensureKey(key) {
  if (!key) throw new Error('Backblaze object key is required');
  return key.replace(/^\/+/, '');
}

function buildPublicUrl(key) {
  if (!publicBaseUrl) return null;
  const safeKey = encodeURI(key).replace(/#/g, '%23');
  return `${publicBaseUrl}/${safeKey}`;
}

export async function uploadObject({ key, body, contentType, cacheSeconds = 3600 }) {
  const normalizedKey = ensureKey(key);
  const command = new PutObjectCommand({
    Bucket: BACKBLAZE_BUCKET_NAME,
    Key: normalizedKey,
    Body: body,
    ContentType: contentType,
    CacheControl: `max-age=${cacheSeconds}`,
  });
  await s3Client.send(command);
  return buildPublicUrl(normalizedKey);
}

export async function deleteObject(key) {
  const normalizedKey = ensureKey(key);
  const command = new DeleteObjectCommand({
    Bucket: BACKBLAZE_BUCKET_NAME,
    Key: normalizedKey,
  });
  await s3Client.send(command);
}

export function extractKeyFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/^\/+/, '');
    if (publicBaseUrl && url.startsWith(`${publicBaseUrl}/`)) {
      return decodeURIComponent(url.slice(publicBaseUrl.length + 1));
    }
    const bucketHost = `${BACKBLAZE_BUCKET_NAME}.s3.${BACKBLAZE_REGION}.backblazeb2.com`.toLowerCase();
    if (hostname === bucketHost) {
      return decodeURIComponent(pathname);
    }
    const parts = pathname.split('/');
    const fileIdx = parts.indexOf('file');
    if (fileIdx !== -1 && parts[fileIdx + 1] === BACKBLAZE_BUCKET_NAME) {
      return decodeURIComponent(parts.slice(fileIdx + 2).join('/'));
    }
  } catch (err) {
    console.warn('[storage] Failed to parse Backblaze URL', err);
  }
  return null;
}

export function getPublicUrlForKey(key) {
  if (!key) return null;
  return buildPublicUrl(key);
}
