from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()
# NullPool, not the default QueuePool: under real concurrent request load, a
# reused pooled connection intermittently served a stale read - a request
# that had just committed a new row (confirmed by direct log evidence: the
# INSERT, its COMMIT, and the immediate 404/401 on a dependent read of that
# exact row, all logged with real timestamps) was invisible to the very next
# request on a *different* connection roughly 40-50ms later, which should be
# impossible under PostgreSQL's READ COMMITTED default. Isolated with three
# controlled experiments (see Module 15 learning log for the full sequence):
# concurrent hashing alone was clean, concurrent direct service-layer calls
# (bypassing HTTP entirely) were clean, and only real HTTP load through
# uvicorn's threadpool with a *reused* connection reproduced it - reliably,
# across users and projects alike. Removing `pool_pre_ping` alone did not
# fix it; only removing connection reuse entirely did (18/18 clean runs
# across three full parallel Playwright runs, versus reliable failures
# within 1-2 runs with either QueuePool configuration). The exact low-level
# mechanism (suspected: reused-connection transaction/snapshot state
# surviving pool checkout despite the default rollback-on-return) was not
# fully traced further - correctness took priority over chasing the last
# mile of a driver-level explanation under time pressure. This trades a
# small per-request connection-setup cost for actually-correct reads, which
# is the right trade for this workshop backend's traffic level; revisit with
# a properly tuned, verified-safe pool if this ever needs to handle
# meaningfully concurrent production load.
engine = create_engine(settings.database_url, poolclass=NullPool)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def database_is_ready() -> bool:
    with engine.connect() as connection:
        return connection.scalar(text("SELECT 1")) == 1
