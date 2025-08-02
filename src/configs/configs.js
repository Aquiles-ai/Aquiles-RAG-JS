import fs from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import envPaths from 'env-paths';


const paths = envPaths('aquiles', { suffix: 'AquilesRAG' });
const dataDir = paths.data;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const CONFIG_FILE = join(dataDir, 'aquiles_config.json');


const DEFAULT_CONFIG = {
  local: true,
  host: 'localhost',
  port: 6379,
  username: '',
  password: '',
  cluster_mode: false,
  tls_mode: false,
  ssl_cert: '',
  ssl_key: '',
  ssl_ca: '',
  allows_api_keys: [''],
  allows_users: [{ username: 'root', password: 'root' }],
};


export function initAquilesConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(DEFAULT_CONFIG, null, 2),
      'utf-8'
    );
  }
}


export function loadAquilesConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error cargando configuración Aquiles:', err);
  }
  return {};
}


export function saveAquilesConfig(configs) {
  try {
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(configs, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Error guardando configuración Aquiles:', err);
  }
}

initAquilesConfig();

