const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { asyncHandler } = require('../utils/asyncHandler');
const path = require('path');
const crypto = require('crypto');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded.' });
  }

  const file = req.file;
  const ext = path.extname(file.originalname);
  const hash = crypto.randomBytes(16).toString('hex');
  const filename = `promotions/${hash}${ext}`; // store in promotions folder

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  // Construct public URL
  let publicUrl = process.env.R2_PUBLIC_URL || '';
  if (publicUrl && !publicUrl.startsWith('http')) {
    publicUrl = `https://${publicUrl}`;
  }
  if (publicUrl && !publicUrl.endsWith('/')) {
    publicUrl += '/';
  }
  
  const fileUrl = `${publicUrl}${filename}`;

  res.json({
    success: true,
    message: 'Image uploaded successfully',
    data: { url: fileUrl },
  });
});

module.exports = { uploadImage };
