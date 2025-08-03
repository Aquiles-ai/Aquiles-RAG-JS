
import fs from 'fs';
import crypto from 'crypto';
import envPaths from 'env-paths';
import path from 'path';

const paths = envPaths('aquiles', { suffix: 'AquilesRAG' });
const dataDir = paths.data;
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const CONFIG_FILE = path.join(dataDir, 'aquiles_config.json'); // esa es la carpeta correcta

/**
 * Represents the deployment configuration.
 * @param {Object} options - Configuration options.
 * @param {boolean} options.local
 * @param {string} options.host
 * @param {number} options.port
 * @param {string} options.username
 * @param {string} options.password
 * @param {boolean} options.cluster_mode
 * @param {boolean} options.tls_mode
 * @param {string} options.ssl_cert
 * @param {string} options.ssl_key
 * @param {string} options.ssl_ca
 * @param {string[]} options.allows_api_keys
 * @param {{username: string, password: string}[]} options.allows_users
 * @param {string} [options.ALGORITHM]
 */
export class DeployConfig {
  constructor(options = {}) {
    const {
      local = false,
      host = process.env.REDIS_HOST || 'localhost',
      port = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      username = process.env.REDIS_USERNAME || '',
      password = process.env.REDIS_PASSWORD || '',
      cluster_mode = false,
      tls_mode = false,
      ssl_cert = '',
      ssl_key = '',
      ssl_ca = '',
      allows_api_keys = [],
      allows_users = [],
      ALGORITHM = 'HS256'
    } = options;

    this.local = local;
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.cluster_mode = cluster_mode;
    this.tls_mode = tls_mode;
    this.ssl_cert = ssl_cert;
    this.ssl_key = ssl_key;
    this.ssl_ca = ssl_ca;
    this.allows_api_keys = allows_api_keys;
    this.allows_users = allows_users;
    this.ALGORITHM = ALGORITHM;
    this.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Converts the configuration to a flat object.
   */
  toObject() {
    return {
      local: this.local,
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      cluster_mode: this.cluster_mode,
      tls_mode: this.tls_mode,
      ssl_cert: this.ssl_cert,
      ssl_key: this.ssl_key,
      ssl_ca: this.ssl_ca,
      allows_api_keys: this.allows_api_keys,
      allows_users: this.allows_users,
      JWT_SECRET: this.JWT_SECRET,
      ALGORITHM: this.ALGORITHM
    };
  }
}

/**
 * Generates the configuration file if it doesn't exist. If it does, it leaves it intact.
 * @param {DeployConfig} config - DeployConfig Instance
 * @returns {string} Path to the generated or existing config file.
 */
export function genConfigsFile(config) {
  const cfgObj = config.toObject();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfgObj, null, 2), 'utf-8');
  }
  return CONFIG_FILE;
}

/**
 * Reads the configuration from the generated file.
 * If it does not exist, returns the default configuration object.
 * @returns {Object}
 */
export function readConfigsFile() {
  if (fs.existsSync(CONFIG_FILE)) {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  }
  throw new Error(`Config file not found at ${CONFIG_FILE}`);
}
