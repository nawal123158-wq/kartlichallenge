from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime
from pymongo import ReturnDocument
import traceback

router = APIRouter(prefix="/api/coins")

class RewardRequest(BaseModel):
    amount: int = Field(..., gt=0, lt=1000)
    reason: str
    game_id: Optional[str] = None

class SpendRequest(BaseModel):
    amount: int = Field(..., gt=0, lt=1000)
    reason: str
    item_id: Optional[str] = None

@router.get("/me")
async def get_my_coins(request: Request):
    """Return current user's coin balance"""
    # import server at runtime to avoid circular import at module load
    import server
    current_user = await server.get_current_user(request)
    user_doc = await server.db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "coins": 1})
    if not user_doc:
        return {"coins": 0}
    coins = user_doc.get("coins", 0)
    return {"coins": coins}

@router.post("/reward")
async def reward_coins(request: Request, body: RewardRequest):
    """Reward coins to current user and log transaction"""
    import server
    try:
        current_user = await server.get_current_user(request)

        # Try atomic increment and return new coins. If driver's find_one_and_update
        # misbehaves in this environment, fall back to update_one + find_one.
        try:
            updated = await server.db.users.find_one_and_update(
                {"user_id": current_user.user_id},
                {"$inc": {"coins": body.amount}},
                projection={"_id": 0, "coins": 1},
                return_document=ReturnDocument.AFTER
            )
        except Exception as e:
            server.logger.warning("find_one_and_update failed in reward_coins, falling back: %s", str(e))
            server.logger.debug(traceback.format_exc())
            await server.db.users.update_one({"user_id": current_user.user_id}, {"$inc": {"coins": body.amount}})
            updated = await server.db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "coins": 1})

        if not updated:
            raise HTTPException(status_code=404, detail="User not found")

        new_balance = updated.get("coins", 0)

        tx = {
            "transaction_id": f"ct_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "amount": body.amount,
            "reason": body.reason,
            "game_id": body.game_id,
            "created_at": datetime.utcnow()
        }
        await server.db.coin_transactions.insert_one(tx)

        return {"coins": new_balance, "transaction": tx}
    except HTTPException:
        raise
    except Exception as e:
        server.logger.exception('Error in reward_coins')
        # Return exception message temporarily for debugging
        raise HTTPException(status_code=500, detail=f'Internal coin error: {str(e)}')

@router.post("/spend")
async def spend_coins(request: Request, body: SpendRequest):
    """Spend coins if user has enough balance; atomic update and log"""
    try:
        import server
        current_user = await server.get_current_user(request)

        # Attempt atomic decrement only if enough coins. Try find_one_and_update
        # first; if it fails due to driver/environment issues, fall back to
        # update_one with conditional filter which is still atomic.
        try:
            updated = await server.db.users.find_one_and_update(
                {"user_id": current_user.user_id, "coins": {"$gte": body.amount}},
                {"$inc": {"coins": -body.amount}},
                projection={"_id": 0, "coins": 1},
                return_document=ReturnDocument.AFTER
            )
        except Exception as e:
            server.logger.warning("find_one_and_update failed in spend_coins, falling back: %s", str(e))
            server.logger.debug(traceback.format_exc())
            res = await server.db.users.update_one({"user_id": current_user.user_id, "coins": {"$gte": body.amount}}, {"$inc": {"coins": -body.amount}})
            if not res or getattr(res, "modified_count", 0) == 0:
                raise HTTPException(status_code=400, detail="Insufficient coins")
            updated = await server.db.users.find_one({"user_id": current_user.user_id}, {"_id": 0, "coins": 1})

        if not updated:
            raise HTTPException(status_code=400, detail="Insufficient coins")

        new_balance = updated.get("coins", 0)

        tx = {
            "transaction_id": f"ct_{uuid.uuid4().hex[:12]}",
            "user_id": current_user.user_id,
            "amount": -body.amount,
            "reason": body.reason,
            "item_id": body.item_id,
            "created_at": datetime.utcnow()
        }
        await server.db.coin_transactions.insert_one(tx)

        return {"coins": new_balance, "transaction": tx}
    except HTTPException:
        raise
    except Exception as e:
        import server
        server.logger.exception('Error in spend_coins')
        # Return exception message temporarily for debugging
        raise HTTPException(status_code=500, detail=f'Internal coin error: {str(e)}')
