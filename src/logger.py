"""Logging configuration for GlanceFive."""
import logging
import sys
from .config import get_settings


def setup_logger(name: str = __name__) -> logging.Logger:
    """Configure and return a logger instance."""
    settings = get_settings()
    logger = logging.getLogger(name)

    if not logger.handlers:
        logger.setLevel(getattr(logging, settings.log_level))

        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
