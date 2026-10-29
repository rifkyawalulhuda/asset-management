from sqlalchemy import Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class ImportRun(Base):
    """One applied import.

    Keeps what a repeated import needs: which file, what it changed, and a
    snapshot of the rows it touched so a bad import can be reversed.
    """

    __tablename__ = "import_runs"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255))
    file_hash = Column(String(64), index=True)
    status = Column(String(20), nullable=False, default="applied")
    years = Column(String(100))

    assets_created = Column(Integer, default=0)
    assets_updated = Column(Integer, default=0)
    assets_unchanged = Column(Integer, default=0)
    assets_deactivated = Column(Integer, default=0)
    assets_reactivated = Column(Integer, default=0)
    approval_created = Column(Integer, default=0)
    approval_updated = Column(Integer, default=0)

    elapsed_ms = Column(Integer)
    snapshot_path = Column(Text)
    note = Column(Text)
    created_at = Column(DateTime, server_default=func.now(), index=True)
