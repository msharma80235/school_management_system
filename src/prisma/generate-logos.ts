import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import prisma from './client';

const sunriseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="sky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#1e3a5f"/>
      <stop offset="100%" style="stop-color:#2563eb"/>
    </linearGradient>
    <linearGradient id="sun" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#ef4444"/>
    </linearGradient>
  </defs>
  <path d="M100 10 L185 50 L185 120 Q185 170 100 190 Q15 170 15 120 L15 50 Z" fill="url(#sky)" stroke="#1e3a5f" stroke-width="2"/>
  <path d="M100 22 L175 58 L175 118 Q175 162 100 180 Q25 162 25 118 L25 58 Z" fill="none" stroke="#ffffff" stroke-width="1.5" opacity="0.3"/>
  <g transform="translate(100,95)" fill="#f59e0b" opacity="0.9">
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(30)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(60)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(90)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(120)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(150)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(180)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(210)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(240)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(270)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(300)"/>
    <rect x="-1.5" y="-45" width="3" height="12" rx="1.5" transform="rotate(330)"/>
  </g>
  <circle cx="100" cy="95" r="25" fill="url(#sun)"/>
  <circle cx="100" cy="95" r="21" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.5"/>
  <g transform="translate(100,140)">
    <path d="M-30,0 Q-30,-15 0,-18 Q30,-15 30,0 L30,15 Q30,5 0,2 Q-30,5 -30,15 Z" fill="#ffffff" opacity="0.9"/>
    <line x1="0" y1="-18" x2="0" y2="2" stroke="#1e3a5f" stroke-width="1.5"/>
  </g>
  <text x="100" y="105" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#ffffff">SA</text>
</svg>`;

const greenValleySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <linearGradient id="gv1" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#059669"/>
      <stop offset="100%" style="stop-color:#065f46"/>
    </linearGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="url(#gv1)" stroke="#065f46" stroke-width="2"/>
  <circle cx="100" cy="100" r="82" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.2"/>
  <circle cx="100" cy="100" r="78" fill="none" stroke="#ffffff" stroke-width="0.5" opacity="0.15"/>
  <g opacity="0.3" fill="#ffffff">
    <polygon points="30,130 65,80 100,130"/>
    <polygon points="70,130 110,70 150,130"/>
    <polygon points="110,130 140,85 170,130"/>
  </g>
  <g transform="translate(100,65)">
    <ellipse cx="0" cy="0" rx="28" ry="22" fill="#34d399" opacity="0.9"/>
    <ellipse cx="-12" cy="8" rx="20" ry="18" fill="#10b981" opacity="0.8"/>
    <ellipse cx="12" cy="8" rx="20" ry="18" fill="#10b981" opacity="0.8"/>
    <ellipse cx="0" cy="-5" rx="22" ry="18" fill="#6ee7b7" opacity="0.7"/>
    <rect x="-4" y="18" width="8" height="20" rx="2" fill="#92400e" opacity="0.8"/>
  </g>
  <g transform="translate(100,125)">
    <path d="M-25,0 Q-25,-12 0,-14 Q25,-12 25,0 L25,12 Q25,4 0,2 Q-25,4 -25,12 Z" fill="#ffffff" opacity="0.85"/>
    <line x1="0" y1="-14" x2="0" y2="2" stroke="#065f46" stroke-width="1.2"/>
  </g>
  <text x="100" y="160" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#ffffff" letter-spacing="3">GREEN VALLEY</text>
  <g fill="#fbbf24" opacity="0.9">
    <polygon points="55,42 57,48 63,48 58,52 60,58 55,54 50,58 52,52 47,48 53,48" transform="scale(0.6) translate(30,20)"/>
    <polygon points="55,42 57,48 63,48 58,52 60,58 55,54 50,58 52,52 47,48 53,48" transform="scale(0.6) translate(210,20)"/>
    <polygon points="55,42 57,48 63,48 58,52 60,58 55,54 50,58 52,52 47,48 53,48" transform="scale(0.5) translate(155,5)"/>
  </g>
</svg>`;

async function generateLogos() {
  const uploadsDir = path.resolve('uploads');
  const assetsDir = path.resolve('assets/logos');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

  // Save SVGs to assets
  fs.writeFileSync(path.join(assetsDir, 'logo-sunrise-academy.svg'), sunriseSvg);
  fs.writeFileSync(path.join(assetsDir, 'logo-green-valley.svg'), greenValleySvg);

  // Convert SVGs to high-res PNGs (400x400 for crisp rendering)
  const sunrisePng = 'logo-sunrise-academy.png';
  const greenValleyPng = 'logo-green-valley.png';

  await sharp(Buffer.from(sunriseSvg))
    .resize(400, 400)
    .png()
    .toFile(path.join(uploadsDir, sunrisePng));

  await sharp(Buffer.from(greenValleySvg))
    .resize(400, 400)
    .png()
    .toFile(path.join(uploadsDir, greenValleyPng));

  // Also save PNGs to assets
  fs.copyFileSync(path.join(uploadsDir, sunrisePng), path.join(assetsDir, sunrisePng));
  fs.copyFileSync(path.join(uploadsDir, greenValleyPng), path.join(assetsDir, greenValleyPng));

  console.log('Logos generated:');
  console.log(`  ${sunrisePng} (PNG for PDF + HTML)`);
  console.log(`  ${greenValleyPng} (PNG for PDF + HTML)`);

  // Update report card configs to use PNGs
  const org1 = await prisma.organization.findUnique({ where: { slug: 'sunrise-academy' } });
  const org2 = await prisma.organization.findUnique({ where: { slug: 'green-valley' } });

  if (org1) {
    await prisma.reportCardConfig.upsert({
      where: { org_id: org1.id },
      update: { institute_logo: sunrisePng },
      create: {
        org_id: org1.id,
        institute_name: 'Sunrise Academy',
        institute_logo: sunrisePng,
        address_line: '123 Education Lane, Mumbai, Maharashtra 400001',
        tagline: 'Nurturing Minds, Building Futures',
        principal_name: 'Dr. Priya Sharma',
      },
    });
    console.log('  Updated Sunrise Academy config');
  }

  if (org2) {
    await prisma.reportCardConfig.upsert({
      where: { org_id: org2.id },
      update: { institute_logo: greenValleyPng },
      create: {
        org_id: org2.id,
        institute_name: 'Green Valley School',
        institute_logo: greenValleyPng,
        address_line: '45 Park Road, Bangalore, Karnataka 560001',
        tagline: 'Learning Through Discovery',
        principal_name: 'Mr. Rajiv Kapoor',
      },
    });
    console.log('  Updated Green Valley config');
  }

  console.log('\nDone! Same logos will appear in HTML view, print, and PDF download.');
}

generateLogos()
  .catch((e) => { console.error('Failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
