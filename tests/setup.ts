import path from "path";
import dotenv from "dotenv";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.test"),
});

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "mongodb://127.0.0.1:27017/safetrade_test?replicaSet=rs0";
process.env.JWT_PRIVATE_KEY ??=
  "-----BEGIN PRIVATE KEY-----\\nMIIBVQIBADANBgkqhkiG9w0BAQEFAASCAT8wggE7AgEAAkEAxDm4f4UoWQ7zUQKj\\nM4G6pW0oJvu2Vz0KJkM0kK6g0vCpYjFgrE0w0cTLT57pA9vN6c7sJk2dY0w0lgrg\\n1m1S8QIDAQABAkA6D3R8z0P5Y+g1xYJmWlNfR9Pjv3S5d2fW4mV7Q7f3FQmY9o8Q\\n2m5bR8l0L1vQ1E5l2Q5w2dQ5x9JvK5n2z0xBAiEA8o8M1dQmP0v7Qm6k1jYQYv5s\\n0V0XQ0vJ0hQvO6c1JgMCIQDJm8m0I6d3a3xg5iZQ5lYQ3fQq6z6Q2v1qjz9k8Q6u\\nYwIgV7d3Qz8m2l7c9c2r2d6m5m4n3q2p1v0t9s8r7q6p5oECIEQ0l7m6n5b4v3c2\\n1x0z9y8w7v6u5t4s3r2q1p0o9n8pAiB7m6n5b4v3c2x1z0y9w8v7u6t5s4r3q2p1\\no0n9m8l7kA==\\n-----END PRIVATE KEY-----";
process.env.JWT_PUBLIC_KEY ??=
  "-----BEGIN PUBLIC KEY-----\\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAMQ5uH+FKFkO81ECozOBuqVtKCb7tlc9\\nCiZDNJCuoNLwqWIxYKxNMNHEy0+e6QPbzenO7CZNnWNMNJYK4NZtUvECAwEAAQ==\\n-----END PUBLIC KEY-----";
process.env.MFA_TOKEN_PRIVATE_KEY ??= process.env.JWT_PRIVATE_KEY;
process.env.MFA_TOKEN_PUBLIC_KEY ??= process.env.JWT_PUBLIC_KEY;
process.env.TOTP_ENCRYPTION_KEY ??= "test-totp-encryption-key-32-bytes";
process.env.GOOGLE_CLIENT_ID ??= "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-google-client-secret";
process.env.GOOGLE_REDIRECT_URI ??= "https://localhost:5001/api/auth/google/callback";
process.env.OAUTH_STATE_SECRET ??= "test-oauth-state-secret";
process.env.OAUTH_SUCCESS_REDIRECT ??= "https://localhost:5173/auth/oauth/callback";
process.env.OAUTH_FAILURE_REDIRECT ??= "https://localhost:5173/login";
