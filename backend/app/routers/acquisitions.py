from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.models.acquisition_disposal import AcquisitionDisposal
from app.schemas.acquisition_disposal import (
    AcquisitionDisposalCreate,
    AcquisitionDisposalUpdate,
    AcquisitionDisposalResponse,
)

router = APIRouter(prefix="/acquisitions", tags=["acquisitions"])


def split_values(raw: str) -> List[str]:
    """Accepts a single value or a comma-separated list of asset numbers."""
    return [part.strip() for part in raw.split(",") if part.strip()]


@router.get("", response_model=List[AcquisitionDisposalResponse])
def list_acquisitions(
    year_ref: Optional[int] = None,
    status: Optional[str] = None,
    asset_id: Optional[int] = None,
    asset_no: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Lists movement records.

    `asset_id` alone is not enough: rows imported before the register was linked,
    or whose number never matched an asset, keep a NULL foreign key. Passing the
    asset numbers as well picks those up through `fixed_asset_no`, so an asset
    page does not silently hide part of its own history.
    """
    query = db.query(AcquisitionDisposal)
    if year_ref:
        query = query.filter(AcquisitionDisposal.year_ref == year_ref)
    if status:
        query = query.filter(AcquisitionDisposal.status == status)

    conditions = []
    if asset_id:
        conditions.append(AcquisitionDisposal.asset_id == asset_id)
    if asset_no:
        numbers = split_values(asset_no)
        if numbers:
            conditions.append(AcquisitionDisposal.fixed_asset_no.in_(numbers))
    if conditions:
        query = query.filter(or_(*conditions))

    return query.order_by(AcquisitionDisposal.transaction_date).all()


@router.post("", response_model=AcquisitionDisposalResponse, status_code=201)
def create_acquisition(payload: AcquisitionDisposalCreate, db: Session = Depends(get_db)):
    record = AcquisitionDisposal(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=AcquisitionDisposalResponse)
def update_acquisition(
    record_id: int, payload: AcquisitionDisposalUpdate, db: Session = Depends(get_db)
):
    record = db.query(AcquisitionDisposal).filter(AcquisitionDisposal.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204)
def delete_acquisition(record_id: int, db: Session = Depends(get_db)):
    record = db.query(AcquisitionDisposal).filter(AcquisitionDisposal.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(record)
    db.commit()
