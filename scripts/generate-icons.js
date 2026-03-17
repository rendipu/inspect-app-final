#!/usr/bin/env node
// scripts/generate-icons.js
// Jalankan: node scripts/generate-icons.js
// Membuat icon PNG sederhana untuk PWA

const { createCanvas } = require('canvas') // npm install canvas
const fs = require('fs')
const path = require('path')

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const OUT_DIR = path.join(__dirname, '../public/icons')

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

for (const size of SIZES) {
  const canvas = createCanvas(size, size)
  const ctx    = canvas.getContext('2d')

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e3a5f')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.roundRect(0, 0, size, size, size * 0.2)
  ctx.fill()

  // Ikon wrench sederhana
  const cx = size / 2
  const cy = size / 2
  const r  = size * 0.28

  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth   = size * 0.07
  ctx.lineCap     = 'round'

  // Lingkaran atas
  ctx.beginPath()
  ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.35, 0, Math.PI * 2)
  ctx.stroke()

  // Batang diagonal
  ctx.beginPath()
  ctx.moveTo(cx - r * 0.05, cy - r * 0.05)
  ctx.lineTo(cx + r * 0.75, cy + r * 0.75)
  ctx.stroke()

  // Ujung bawah
  ctx.beginPath()
  ctx.arc(cx + r * 0.75, cy + r * 0.75, r * 0.2, 0, Math.PI * 2)
  ctx.stroke()

  // Text "I"
  ctx.fillStyle  = '#f59e0b'
  ctx.font       = `bold ${Math.round(size * 0.22)}px sans-serif`
  ctx.textAlign  = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('I', cx + r * 0.35, cy - r * 0.55)

  const buffer = canvas.toBuffer('image/png')
  const file   = path.join(OUT_DIR, `icon-${size}x${size}.png`)
  fs.writeFileSync(file, buffer)
  console.log(`✅ ${file}`)
}

console.log(`\n🎉 ${SIZES.length} icons dibuat di public/icons/`)
console.log('Atau gunakan https://realfavicongenerator.net untuk icon yang lebih bagus')
