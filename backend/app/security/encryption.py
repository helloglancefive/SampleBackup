"""
AES-256-GCM encryption for Amazon credentials stored in the database.
Key loaded from ENCRYPTION_KEY env var (Fernet-generated 32-byte base64).
"""
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, status


def _get_key(encryption_key: str) -> bytes:
    key_bytes = base64.urlsafe_b64decode(encryption_key + "==")
    if len(key_bytes) < 32:
        raise ValueError("ENCRYPTION_KEY must be at least 32 bytes when base64-decoded")
    return key_bytes[:32]


def encrypt_credential(plaintext: str, encryption_key: str) -> str:
    """Returns base64(12-byte nonce + ciphertext) for DB storage."""
    key = _get_key(encryption_key)
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode()


def decrypt_credential(encrypted: str, encryption_key: str) -> str:
    """Decrypts value stored by encrypt_credential."""
    if not encrypted:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Missing credential")
    key = _get_key(encryption_key)
    aesgcm = AESGCM(key)
    raw = base64.urlsafe_b64decode(encrypted)
    nonce, ciphertext = raw[:12], raw[12:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode()
