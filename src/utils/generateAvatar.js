import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export function gerarAvatar(letra) {
  const canvas = createCanvas(200, 200);
  const ctx = canvas.getContext('2d');

  // Lista de cores de fundo
  const cores = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'];
  const corAleatoria = cores[Math.floor(Math.random() * cores.length)];

  // Fundo colorido com cor aleatória
  ctx.fillStyle = corAleatoria;
  ctx.fillRect(0, 0, 200, 200);

  // Letra branca centralizada
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 100px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letra.toUpperCase(), 100, 110);

  // Caminho do arquivo
  const filename = `${uuidv4()}.png`;
  const filePath = path.join('uploads', 'avatars', filename);

  // Garante que a pasta exista
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  // Salva o arquivo
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buffer);

  return `http://localhost:3000/${filePath.replace(/\\/g, '/')}`;
}
