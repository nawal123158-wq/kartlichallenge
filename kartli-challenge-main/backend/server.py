from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import random
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.getenv('MONGO_URL')
db_name = os.getenv('DB_NAME')

client = None
db = None
if mongo_url and db_name:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Simple localization support (English + Turkish)
translations = {
    "en": {
        "logged_out": "Logged out",
        "friend_request_sent": "Friend request sent",
        "friend_request_accepted": "Friend request accepted",
        "friend_request_rejected": "Friend request rejected",
        "joined_group": "Joined group",
        "invitation_sent": "Invitation sent",
        "joined_group_game_success": "Joined group and game successfully",
        "joined_game_auto_started": "Joined game - Auto-started with 2 players!",
        "joined_game": "Joined game",
        "game_started": "Game started",
        "card_played": "Card played",
        "passed": "Passed",
        "card_swapped": "Card swapped",
        "approved": "Approved",
        "rejected": "Rejected",
        "vote_recorded": "Vote recorded",
        "marked_as_read": "Marked as read",
        "all_marked_as_read": "All marked as read",
        "api_info": "Kartlı Challenge API",
        "healthy": "healthy"
    },
    "tr": {
        "logged_out": "Çıkış yapıldı",
        "friend_request_sent": "Arkadaşlık isteği gönderildi",
        "friend_request_accepted": "Arkadaşlık isteği kabul edildi",
        "friend_request_rejected": "Arkadaşlık isteği reddedildi",
        "joined_group": "Gruba katıldı",
        "invitation_sent": "Davet gönderildi",
        "joined_group_game_success": "Gruba ve oyuna başarıyla katıldı",
        "joined_game_auto_started": "Oyuna katıldı - 2 oyuncuyla otomatik başlatıldı!",
        "joined_game": "Oyuna katıldı",
        "game_started": "Oyun başlatıldı",
        "card_played": "Kart oynandı",
        "passed": "Pas geçti",
        "card_swapped": "Kart değiştirildi",
        "approved": "Onaylandı",
        "rejected": "Reddedildi",
        "vote_recorded": "Oy kaydedildi",
        "marked_as_read": "Okundu olarak işaretlendi",
        "all_marked_as_read": "Tüm bildirimler okundu olarak işaretlendi",
        "api_info": "Kartlı Challenge API",
        "healthy": "sağlıklı"
    }
}

def _get_lang_from_request(request: Request) -> str:
    """Determine language from `lang` query param or `Accept-Language` header."""
    if not request:
        return "en"
    # query param `?lang=tr`
    q = request.query_params.get("lang") if request.query_params else None
    if q:
        return q.split(",")[0].split("-")[0]
    al = request.headers.get("accept-language")
    if al:
        return al.split(",")[0].split("-")[0]
    return "en"

def t(key: str, request: Request):
    lang = _get_lang_from_request(request)
    return translations.get(lang, translations["en"]).get(key, translations["en"].get(key, key))

# ==================== MODELS ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    player_id: str
    created_at: datetime
    weekly_score: int = 0
    total_score: int = 0
    coins: int = 0

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class SessionDataResponse(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

class FriendRequest(BaseModel):
    request_id: str
    from_user_id: str
    to_user_id: str
    status: str = "pending"  # pending, accepted, rejected
    created_at: datetime

class Friend(BaseModel):
    friendship_id: str
    user1_id: str
    user2_id: str
    created_at: datetime

class Group(BaseModel):
    group_id: str
    name: str
    invite_code: str
    created_by: str
    created_at: datetime
    max_players: int = 10

class GroupMember(BaseModel):
    membership_id: str
    group_id: str
    user_id: str
    joined_at: datetime
    is_admin: bool = False

class Card(BaseModel):
    card_id: str
    deck_type: str  # komik, sosyal, beceri, cevre, ceza
    title: str
    description: str
    difficulty: int = 1  # 1-3
    points: int = 1
    time_limit: Optional[int] = None  # seconds

class Game(BaseModel):
    game_id: str
    group_id: str
    status: str = "waiting"  # waiting, ready, started, finished
    current_hand: int = 0
    created_by: str
    created_at: datetime
    finished_at: Optional[datetime] = None

class GamePlayer(BaseModel):
    player_entry_id: str
    game_id: str
    user_id: str
    pass_used: bool = False
    swap_used: bool = False
    score: int = 0
    joined_at: datetime

class HandCard(BaseModel):
    hand_card_id: str
    game_id: str
    hand_number: int
    user_id: str
    card_id: str
    status: str = "in_hand"  # in_hand, played, discarded, passed

class Submission(BaseModel):
    submission_id: str
    game_id: str
    hand_number: int
    user_id: str
    card_id: str
    photo_base64: Optional[str] = None
    note: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    created_at: datetime
    votes_approve: int = 0
    votes_reject: int = 0

class Vote(BaseModel):
    vote_id: str
    submission_id: str
    voter_id: str
    vote_type: str  # approve, reject
    created_at: datetime

class Penalty(BaseModel):
    penalty_id: str
    game_id: str
    user_id: str
    card_id: str
    reason: str
    created_at: datetime

class ChatMessage(BaseModel):
    message_id: str
    game_id: str
    user_id: str
    content: str
    message_type: str = "text"  # text, submission, system
    submission_id: Optional[str] = None
    created_at: datetime

class Notification(BaseModel):
    notification_id: str
    user_id: str
    type: str  # friend_request, game_invite, vote_needed, game_started
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    read: bool = False
    created_at: datetime

# ==================== REQUEST MODELS ====================

class CreateGroupRequest(BaseModel):
    name: str

class JoinGroupRequest(BaseModel):
    invite_code: str
    referrer_player_id: Optional[str] = None

class SendFriendRequestRequest(BaseModel):
    player_id: str

class CreateGameRequest(BaseModel):
    group_id: str

class PlayCardRequest(BaseModel):
    card_id: str
    action: str  # play, pass, refuse
    photo_base64: Optional[str] = None
    note: Optional[str] = None

class VoteRequest(BaseModel):
    vote_type: str  # approve, reject

class SendMessageRequest(BaseModel):
    content: str

class SwapCardRequest(BaseModel):
    card_id: str

class SelectCardRequest(BaseModel):
    card_id: str

# ==================== AUTH HELPERS ====================

async def get_session_token(request: Request) -> Optional[str]:
    # Check cookie first
    token = request.cookies.get("session_token")
    if token:
        return token
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request) -> User:
    token = await get_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

async def get_optional_user(request: Request) -> Optional[User]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# ==================== DECK INITIALIZATION ====================

SAMPLE_CARDS = {
    "komik": [
        {"title": "Mimik Selfie", "description": "En komik yüz ifadenizle selfie çekin.", "difficulty": 1, "points": 1},
        {"title": "Acayip Dans", "description": "En garip dans hareketinizi 15 saniye boyunca yapın.", "difficulty": 1, "points": 1},
        {"title": "Söz Balonu", "description": "Bir kağıda komik bir söz yazın ve onunla fotoğraf çekin.", "difficulty": 2, "points": 2},
        {"title": "Bebek Pozu", "description": "Bebek gibi poz verip fotoğraf çekin.", "difficulty": 1, "points": 1},
        {"title": "Yavaş Çekim", "description": "Bir hareketi yavaş çekim modunda yapın.", "difficulty": 1, "points": 1},
        {"title": "Robot Dansı", "description": "Robot gibi hareket ederek 20 saniye dans edin.", "difficulty": 2, "points": 1},
        {"title": "Hayvan Taklidi Foto", "description": "Bir hayvanı taklit eden bir poz verip fotoğraf çekin.", "difficulty": 1, "points": 1},
        {"title": "Yemek Sunumu", "description": "Son yediğiniz yemeğin en iyi açıdan fotoğrafını çekin.", "difficulty": 2, "points": 2},
    ],
    "sosyal": [
        {"title": "Selfie Time", "description": "Yabancı biriyle selfie çekin.", "difficulty": 3, "points": 3},
        {"title": "Teşekkür Et", "description": "Bir aile üyenize teşekkür mesajı atın.", "difficulty": 1, "points": 1},
        {"title": "İltifat Yağmuru", "description": "Yanınızdaki birine samimi bir iltifat edin.", "difficulty": 1, "points": 1},
        {"title": "Hikaye Paylaş", "description": "Sosyal medyada komik bir hikaye paylaşın.", "difficulty": 2, "points": 1},
        {"title": "Eski Arkadaş", "description": "Uzun süredir konuşmadığınız birine mesaj atın.", "difficulty": 2, "points": 2},
        {"title": "Komşuya Selam", "description": "Komşunuza gidip merhaba deyin.", "difficulty": 2, "points": 2},
        {"title": "Anı Fotoğrafı", "description": "Bir arkadaşınızla birlikte fotoğraf çekin (selfie olabilir).", "difficulty": 1, "points": 1},
        {"title": "Yorum Yap", "description": "Bir arkadaşınızın eski bir fotoğrafına yorum yapın.", "difficulty": 1, "points": 1},
    ],
    "beceri": [
        {"title": "Tek Ayak", "description": "30 saniye tek ayak üstünde durun.", "difficulty": 1, "points": 1, "time_limit": 30},
        {"title": "Dil Bükücü", "description": "'Şişli'deki şişman şişçinin şişleri' cümlesini bir kağıda yazın ve fotoğrafını çekin.", "difficulty": 2, "points": 2, "time_limit": 30},
        {"title": "Şınav Challenge", "description": "10 şınav çekin.", "difficulty": 2, "points": 2, "time_limit": 60},
        {"title": "Kaşık Dengesi", "description": "Burnunuzda kaşık dengeleyin.", "difficulty": 2, "points": 2, "time_limit": 30},
        {"title": "Hızlı Yazma", "description": "Gözleriniz kapalı isminizi yazın.", "difficulty": 1, "points": 1, "time_limit": 30},
        {"title": "Parmak Sayma", "description": "10'dan 1'e kadar parmaklarınızla hızlıca gösterin.", "difficulty": 1, "points": 1, "time_limit": 15},
        {"title": "El Becerisi", "description": "Bir kağıdı tek elle katlayın.", "difficulty": 2, "points": 2, "time_limit": 45},
        {"title": "Hafıza Oyunu", "description": "Masadaki 5 nesneyi ezberleyip sayın.", "difficulty": 2, "points": 2, "time_limit": 60},
    ],
    "cevre": [
        {"title": "Oda Detayı", "description": "Odanızdaki 3 objeyi tek karede gösteren bir fotoğraf çekin.", "difficulty": 1, "points": 1},
        {"title": "Pencere Manzarası", "description": "Pencerenizden manzara fotoğrafı çekin.", "difficulty": 1, "points": 1},
        {"title": "Kitaplık Görevi", "description": "En son okuduğunuz kitabı gösterin.", "difficulty": 1, "points": 1},
        {"title": "Buzdolabı Check", "description": "Buzdolabınızdaki en ilginç şeyi gösterin.", "difficulty": 1, "points": 1},
        {"title": "Bitki Bakımı", "description": "Evdeki bir bitkiyi sulayın.", "difficulty": 1, "points": 1},
        {"title": "Temizlik Vakti", "description": "Masanızı 30 saniyede düzenleyin.", "difficulty": 1, "points": 1, "time_limit": 30},
        {"title": "Evcil Hayvan", "description": "Evcil hayvanınızı veya bir oyuncağı gösterin.", "difficulty": 1, "points": 1},
        {"title": "Balkon/Bahçe", "description": "Balkon veya bahçenizden bir fotoğraf paylaşın.", "difficulty": 1, "points": 1},
    ],
    "ceza": [
        {"title": "Tavuk Dansı", "description": "30 saniye tavuk gibi dans edin.", "difficulty": 1, "points": 0},
        {"title": "Özür Notu", "description": "Bir kağıda özür notu yazın ve fotoğrafını paylaşın.", "difficulty": 1, "points": 0},
        {"title": "Utanç Yüzü", "description": "En utanç verici yüz ifadenizi yapın.", "difficulty": 1, "points": 0},
        {"title": "Çocukluk Anısı", "description": "Çocukluğunuzdan bir fotoğraf paylaşın (yoksa eski bir objenin fotoğrafı da olur).", "difficulty": 1, "points": 0},
        {"title": "Diz Çök", "description": "Gruba diz çökerek af dileyin.", "difficulty": 2, "points": 0},
        {"title": "Emoji Yüzü", "description": "5 farklı emoji yüz ifadesini taklit edin.", "difficulty": 1, "points": 0},
        {"title": "İtiraf", "description": "Küçük bir itirafta bulunun.", "difficulty": 2, "points": 0},
        {"title": "Alkış", "description": "Kendinize 30 saniye alkışlayın.", "difficulty": 1, "points": 0},
    ]
}

async def initialize_decks():
    """Initialize card decks if they don't exist"""
    for deck_type, cards in SAMPLE_CARDS.items():
        for card_data in cards:
            await db.cards.update_one(
                {"deck_type": deck_type, "title": card_data["title"]},
                {
                    "$set": {"deck_type": deck_type, **card_data},
                    "$setOnInsert": {"card_id": f"card_{uuid.uuid4().hex[:12]}"}
                },
                upsert=True
            )

    removed = {
        ("komik", "Taklit Ustası"),
        ("komik", "Şarkı Sözü"),
        ("komik", "Bebek Sesi"),
        ("komik", "Hayvan Sesi"),
        ("komik", "Rap Yapma"),
        ("sosyal", "Telefon Görüşmesi"),
        ("cevre", "Oda Turu"),
        ("ceza", "Özür Dileme"),
        ("ceza", "Çocuk Şarkısı"),
    }
    for deck_type, title in removed:
        await db.cards.delete_many({"deck_type": deck_type, "title": title})

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/session")
async def exchange_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth API
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session_id")
            
            user_data = auth_response.json()
        except httpx.RequestError as e:
            logger.error(f"Auth API error: {e}")
            raise HTTPException(status_code=500, detail="Auth service unavailable")
    
    session_data = SessionDataResponse(**user_data)
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": session_data.email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user with unique player_id
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        player_id = f"PLR{uuid.uuid4().hex[:6].upper()}"
        
        new_user = {
            "user_id": user_id,
            "email": session_data.email,
            "name": session_data.name,
            "picture": session_data.picture,
            "player_id": player_id,
            "created_at": datetime.now(timezone.utc),
            "weekly_score": 0,
            "total_score": 0
        }
        await db.users.insert_one(new_user)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_data.session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_data.session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_data.session_token}

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    token = await get_session_token(request)
    if token:
        await db.user_sessions.delete_many({"session_token": token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": t("logged_out", request)}

@api_router.get("/auth/check")
async def check_auth(request: Request):
    """Check if user is authenticated"""
    user = await get_optional_user(request)
    return {"authenticated": user is not None, "user": user}

# ==================== USER ENDPOINTS ====================

@api_router.get("/users/search/{player_id}")
async def search_user_by_player_id(player_id: str, current_user: User = Depends(get_current_user)):
    """Search user by player ID"""
    user = await db.users.find_one({"player_id": player_id.upper()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Player not found")
    if user["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot search yourself")
    return {"user_id": user["user_id"], "name": user["name"], "player_id": user["player_id"], "picture": user.get("picture")}

@api_router.get("/users/leaderboard")
async def get_leaderboard(current_user: User = Depends(get_current_user)):
    """Get weekly leaderboard"""
    users = await db.users.find({}, {"_id": 0}).sort("weekly_score", -1).limit(50).to_list(50)
    return users

# ==================== FRIEND ENDPOINTS ====================

@api_router.post("/friends/request")
async def send_friend_request(request: Request, req: SendFriendRequestRequest, current_user: User = Depends(get_current_user)):
    """Send friend request by player ID"""
    target_user = await db.users.find_one({"player_id": req.player_id.upper()}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="Player not found")
    
    if target_user["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")
    
    # Check if already friends
    existing_friendship = await db.friends.find_one({
        "$or": [
            {"user1_id": current_user.user_id, "user2_id": target_user["user_id"]},
            {"user1_id": target_user["user_id"], "user2_id": current_user.user_id}
        ]
    })
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already sent
    existing_request = await db.friend_requests.find_one({
        "from_user_id": current_user.user_id,
        "to_user_id": target_user["user_id"],
        "status": "pending"
    })
    if existing_request:
        raise HTTPException(status_code=400, detail="Request already sent")
    
    # Create request
    request_obj = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "from_user_id": current_user.user_id,
        "to_user_id": target_user["user_id"],
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.friend_requests.insert_one(request_obj)
    
    # Create notification
    await create_notification(
        target_user["user_id"],
        "friend_request",
        "Arkadaşlık İsteği",
        f"{current_user.name} size arkadaşlık isteği gönderdi",
        {"request_id": request_obj["request_id"], "from_user_id": current_user.user_id}
    )
    
    return {"message": t("friend_request_sent", request), "request_id": request_obj["request_id"]}

@api_router.get("/friends/requests")
async def get_friend_requests(current_user: User = Depends(get_current_user)):
    """Get pending friend requests"""
    requests = await db.friend_requests.find({
        "to_user_id": current_user.user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Enrich with user info
    for req in requests:
        from_user = await db.users.find_one({"user_id": req["from_user_id"]}, {"_id": 0})
        if from_user:
            req["from_user"] = {"name": from_user["name"], "player_id": from_user["player_id"], "picture": from_user.get("picture")}
    
    return requests

@api_router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request(request: Request, request_id: str, current_user: User = Depends(get_current_user)):
    """Accept friend request"""
    req = await db.friend_requests.find_one({"request_id": request_id, "to_user_id": current_user.user_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")
    
    # Update request
    await db.friend_requests.update_one({"request_id": request_id}, {"$set": {"status": "accepted"}})
    
    # Create friendship
    friendship = {
        "friendship_id": f"friend_{uuid.uuid4().hex[:12]}",
        "user1_id": req["from_user_id"],
        "user2_id": current_user.user_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.friends.insert_one(friendship)
    
    return {"message": t("friend_request_accepted", request)}

@api_router.post("/friends/requests/{request_id}/reject")
async def reject_friend_request(request: Request, request_id: str, current_user: User = Depends(get_current_user)):
    """Reject friend request"""
    req = await db.friend_requests.find_one({"request_id": request_id, "to_user_id": current_user.user_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    await db.friend_requests.update_one({"request_id": request_id}, {"$set": {"status": "rejected"}})
    return {"message": t("friend_request_rejected", request)}

@api_router.get("/friends")
async def get_friends(current_user: User = Depends(get_current_user)):
    """Get friends list"""
    friendships = await db.friends.find({
        "$or": [
            {"user1_id": current_user.user_id},
            {"user2_id": current_user.user_id}
        ]
    }, {"_id": 0}).to_list(100)
    
    friends = []
    for f in friendships:
        friend_id = f["user2_id"] if f["user1_id"] == current_user.user_id else f["user1_id"]
        friend = await db.users.find_one({"user_id": friend_id}, {"_id": 0})
        if friend:
            friends.append({
                "user_id": friend["user_id"],
                "name": friend["name"],
                "player_id": friend["player_id"],
                "picture": friend.get("picture"),
                "weekly_score": friend.get("weekly_score", 0)
            })
    
    return friends

# ==================== GROUP ENDPOINTS ====================

@api_router.post("/groups")
async def create_group(req: CreateGroupRequest, current_user: User = Depends(get_current_user)):
    """Create a new group"""
    invite_code = uuid.uuid4().hex[:8].upper()
    
    group = {
        "group_id": f"grp_{uuid.uuid4().hex[:12]}",
        "name": req.name,
        "invite_code": invite_code,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        "max_players": 10
    }
    await db.groups.insert_one(group)
    
    # Add creator as admin member
    membership = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "group_id": group["group_id"],
        "user_id": current_user.user_id,
        "joined_at": datetime.now(timezone.utc),
        "is_admin": True
    }
    await db.group_members.insert_one(membership)
    
    # Remove _id fields before returning
    group.pop("_id", None)
    membership.pop("_id", None)
    
    return {"group": group, "membership": membership}

@api_router.post("/groups/join")
async def join_group(request: Request, req: JoinGroupRequest, current_user: User = Depends(get_current_user)):
    """Join group by invite code"""
    group = await db.groups.find_one({"invite_code": req.invite_code.upper()}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    
    # Check if already member
    existing = await db.group_members.find_one({
        "group_id": group["group_id"],
        "user_id": current_user.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    
    # Check member count
    member_count = await db.group_members.count_documents({"group_id": group["group_id"]})
    if member_count >= group.get("max_players", 10):
        raise HTTPException(status_code=400, detail="Group is full")
    
    membership = {
        "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
        "group_id": group["group_id"],
        "user_id": current_user.user_id,
        "joined_at": datetime.now(timezone.utc),
        "is_admin": False
    }
    await db.group_members.insert_one(membership)

    referral_awarded = False
    if req.referrer_player_id:
        ref_pid = req.referrer_player_id.strip().upper()
        if ref_pid and ref_pid != current_user.player_id.upper():
            ref_user = await db.users.find_one({"player_id": ref_pid}, {"_id": 0})
            if ref_user and ref_user.get("user_id") != current_user.user_id:
                existing_ref = await db.referrals.find_one({
                    "referred_user_id": current_user.user_id,
                    "type": "group_join"
                })
                if not existing_ref:
                    now = datetime.utcnow()
                    ref_amt = 20
                    new_amt = 10

                    await db.users.update_one({"user_id": ref_user["user_id"]}, {"$inc": {"coins": ref_amt}})
                    await db.users.update_one({"user_id": current_user.user_id}, {"$inc": {"coins": new_amt}})

                    await db.coin_transactions.insert_one({
                        "transaction_id": f"ct_{uuid.uuid4().hex[:12]}",
                        "user_id": ref_user["user_id"],
                        "amount": ref_amt,
                        "reason": "referral_invite",
                        "group_id": group["group_id"],
                        "created_at": now
                    })
                    await db.coin_transactions.insert_one({
                        "transaction_id": f"ct_{uuid.uuid4().hex[:12]}",
                        "user_id": current_user.user_id,
                        "amount": new_amt,
                        "reason": "referral_join",
                        "group_id": group["group_id"],
                        "created_at": now
                    })

                    await db.referrals.insert_one({
                        "referral_id": f"ref_{uuid.uuid4().hex[:12]}",
                        "type": "group_join",
                        "referrer_user_id": ref_user["user_id"],
                        "referrer_player_id": ref_pid,
                        "referred_user_id": current_user.user_id,
                        "group_id": group["group_id"],
                        "created_at": now
                    })
                    referral_awarded = True
    
    return {"message": t("joined_group", request), "group": group, "referral_awarded": referral_awarded}

@api_router.get("/groups")
async def get_my_groups(current_user: User = Depends(get_current_user)):
    """Get groups user is member of"""
    memberships = await db.group_members.find({"user_id": current_user.user_id}, {"_id": 0}).to_list(100)
    
    groups = []
    for m in memberships:
        group = await db.groups.find_one({"group_id": m["group_id"]}, {"_id": 0})
        if group:
            member_count = await db.group_members.count_documents({"group_id": group["group_id"]})
            group["member_count"] = member_count
            group["is_admin"] = m.get("is_admin", False)
            groups.append(group)
    
    return groups

@api_router.get("/groups/{group_id}")
async def get_group_details(group_id: str, current_user: User = Depends(get_current_user)):
    """Get group details with members and active game"""
    # Check membership
    membership = await db.group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.user_id
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
    
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Get members
    members_data = await db.group_members.find({"group_id": group_id}, {"_id": 0}).to_list(100)
    members = []
    for m in members_data:
        user = await db.users.find_one({"user_id": m["user_id"]}, {"_id": 0})
        if user:
            members.append({
                "user_id": user["user_id"],
                "name": user["name"],
                "player_id": user["player_id"],
                "picture": user.get("picture"),
                "is_admin": m.get("is_admin", False),
                "weekly_score": user.get("weekly_score", 0)
            })
    
    group["members"] = members
    group["is_admin"] = membership.get("is_admin", False)
    
    # Check for active/waiting/ready/started game
    active_game = await db.games.find_one({
        "group_id": group_id,
        "status": {"$in": ["waiting", "ready", "started"]}
    }, {"_id": 0})
    
    if active_game:
        # Check if current user is in the game
        player_entry = await db.game_players.find_one({
            "game_id": active_game["game_id"],
            "user_id": current_user.user_id
        })
        active_game["is_player"] = player_entry is not None
        
        # Get player count
        player_count = await db.game_players.count_documents({"game_id": active_game["game_id"]})
        active_game["player_count"] = player_count
        
        group["active_game"] = active_game
    else:
        group["active_game"] = None
    
    return group

@api_router.post("/groups/{group_id}/invite/{friend_user_id}")
async def invite_friend_to_group(request: Request, group_id: str, friend_user_id: str, current_user: User = Depends(get_current_user)):
    """Invite a friend to group"""
    # Check if current user is member
    membership = await db.group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.user_id
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
    
    # Check if they are friends
    friendship = await db.friends.find_one({
        "$or": [
            {"user1_id": current_user.user_id, "user2_id": friend_user_id},
            {"user1_id": friend_user_id, "user2_id": current_user.user_id}
        ]
    })
    if not friendship:
        raise HTTPException(status_code=400, detail="Not friends")
    
    # Check if already member
    existing = await db.group_members.find_one({
        "group_id": group_id,
        "user_id": friend_user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    
    group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
    
    # Create notification
    await create_notification(
        friend_user_id,
        "game_invite",
        "Grup Daveti",
        f"{current_user.name} sizi {group['name']} grubuna davet etti",
        {"group_id": group_id, "invite_code": group["invite_code"]}
    )
    
    return {"message": t("invitation_sent", request)}

# ==================== GAME ENDPOINTS ====================

@api_router.post("/games")
async def create_game(req: CreateGameRequest, current_user: User = Depends(get_current_user)):
    """Create a new game in a group"""
    # Check membership
    membership = await db.group_members.find_one({
        "group_id": req.group_id,
        "user_id": current_user.user_id
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Check active game (include 'ready' and 'started')
    active_game = await db.games.find_one({
        "group_id": req.group_id,
        "status": {"$in": ["waiting", "ready", "started"]}
    }, {"_id": 0})
    if active_game:
        raise HTTPException(status_code=400, detail="A game is already in progress")
    
    game = {
        "game_id": f"game_{uuid.uuid4().hex[:12]}",
        "group_id": req.group_id,
        "status": "waiting",
        "current_round": 0,
        "creator_id": current_user.user_id,
        "created_by": current_user.user_id,
        "created_at": datetime.now(timezone.utc),
        "finished_at": None,
        # --- SIRAYLA KART SEÇME İÇİN ---
        "players": [],            # oyundaki oyuncular
        "turn_order": [],         # sıra listesi (user_id'ler)
        "current_turn_index": 0,  # şu an kimin sırası
        "ready_players": [],      # kimler ready dedi
        "turn_started_at": None   # son turun başlangıç zamanı (datetime)
    }
    await db.games.insert_one(game)
    
    # Add creator as player
    player_entry = {
        "player_entry_id": f"pe_{uuid.uuid4().hex[:12]}",
        "game_id": game["game_id"],
        "user_id": current_user.user_id,
        "pass_used": False,
        "swap_used": False,
        "score": 0,
        "joined_at": datetime.now(timezone.utc),
    }
    await db.game_players.insert_one(player_entry)
    
    # --- SIRAYA EKLE ---
    game["players"].append(current_user.user_id)
    game["turn_order"].append(current_user.user_id)
    game["current_turn_index"] = 0
    
    # game dokümanını DB'de güncelle (sıra bilgisi kalıcı olsun)
    await db.games.update_one(
        {"game_id": game["game_id"]},
        {"$set": {
            "players": game["players"],
            "turn_order": game["turn_order"],
            "current_turn_index": game["current_turn_index"]
        }}
    )
    
    # Notify other group members
    members = await db.group_members.find({"group_id": req.group_id}, {"_id": 0}).to_list(100)
    group = await db.groups.find_one({"group_id": req.group_id}, {"_id": 0})
    for m in members:
        if m["user_id"] != current_user.user_id:
            await create_notification(
                m["user_id"],
                "game_started",
                "Yeni Oyun Başladı!",
                f"{current_user.name} {group['name']} grubunda yeni bir oyun başlattı! Katıl!",
                {"game_id": game["game_id"], "group_id": req.group_id, "action": "join_game"}
            )
    
    # Also notify friends who are not in the group
    friendships = await db.friends.find({
        "$or": [
            {"user1_id": current_user.user_id},
            {"user2_id": current_user.user_id}
        ]
    }, {"_id": 0}).to_list(100)
    
    member_ids = [m["user_id"] for m in members]
    for f in friendships:
        friend_id = f["user2_id"] if f["user1_id"] == current_user.user_id else f["user1_id"]
        if friend_id not in member_ids:
            await create_notification(
                friend_id,
                "game_invite",
                "Oyun Daveti!",
                f"{current_user.name} seni {group['name']} grubunda oyuna davet ediyor!",
                {"game_id": game["game_id"], "group_id": req.group_id, "invite_code": group["invite_code"], "action": "join_group_and_game"}
            )
    
    # Remove _id field before returning
    game.pop("_id", None)
    
    return game

# Join group and game from notification
@api_router.post("/notifications/{notification_id}/accept-invite")
async def accept_game_invite(request: Request, notification_id: str, current_user: User = Depends(get_current_user)):
    """Accept game invite from notification - joins group and game automatically"""
    notif = await db.notifications.find_one({
        "notification_id": notification_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    data = notif.get("data", {})
    group_id = data.get("group_id")
    game_id = data.get("game_id")
    invite_code = data.get("invite_code")
    
    if not group_id or not game_id:
        raise HTTPException(status_code=400, detail="Invalid notification data")
    
    # Check if already a member of the group
    existing_membership = await db.group_members.find_one({
        "group_id": group_id,
        "user_id": current_user.user_id
    })
    
    if not existing_membership:
        # Join the group first
        group = await db.groups.find_one({"group_id": group_id}, {"_id": 0})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        
        membership = {
            "membership_id": f"mem_{uuid.uuid4().hex[:12]}",
            "group_id": group_id,
            "user_id": current_user.user_id,
            "joined_at": datetime.now(timezone.utc),
            "is_admin": False
        }
        await db.group_members.insert_one(membership)
    
    # Check if the game is still in waiting status
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started or finished")
    
    # Check if already joined the game
    existing_player = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    })
    
    if not existing_player:
        # Join the game
        player_entry = {
            "player_entry_id": f"pe_{uuid.uuid4().hex[:12]}",
            "game_id": game_id,
            "user_id": current_user.user_id,
            "pass_used": False,
            "swap_used": False,
            "score": 0,
            "joined_at": datetime.now(timezone.utc)
        }
        await db.game_players.insert_one(player_entry)
    
    # Mark notification as read
    await db.notifications.update_one(
        {"notification_id": notification_id},
        {"$set": {"read": True}}
    )
    
    return {"message": t("joined_group_game_success", request), "game_id": game_id, "group_id": group_id}

@api_router.post("/games/{game_id}/join")
async def join_game(request: Request, game_id: str, current_user: User = Depends(get_current_user)):
    """Join a waiting game - auto-starts at 2+ players, removes from other group games"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "waiting":
        raise HTTPException(status_code=400, detail="Game already started or finished")
    
    # Check membership
    membership = await db.group_members.find_one({
        "group_id": game["group_id"],
        "user_id": current_user.user_id
    })
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this group")
    
    # Check if already joined
    existing = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already joined")
    
    # REMOVE PLAYER FROM OTHER GAMES IN THE SAME GROUP
    other_games = await db.games.find({
        "group_id": game["group_id"],
        "game_id": {"$ne": game_id},
        "status": {"$in": ["waiting", "ready", "started"]}
    }, {"_id": 0}).to_list(100)
    
    for other_game in other_games:
        # Remove from game_players collection
        await db.game_players.delete_one({
            "game_id": other_game["game_id"],
            "user_id": current_user.user_id
        })
        
        # Remove from players and turn_order arrays
        await db.games.update_one(
            {"game_id": other_game["game_id"]},
            {"$pull": {"players": current_user.user_id, "turn_order": current_user.user_id}}
        )
    
    # ADD PLAYER TO THIS GAME
    player_entry = {
        "player_entry_id": f"pe_{uuid.uuid4().hex[:12]}",
        "game_id": game_id,
        "user_id": current_user.user_id,
        "pass_used": False,
        "swap_used": False,
        "score": 0,
        "joined_at": datetime.now(timezone.utc)
    }
    await db.game_players.insert_one(player_entry)
    
    # Add to players and turn_order arrays
    await db.games.update_one(
        {"game_id": game_id},
        {"$addToSet": {"players": current_user.user_id, "turn_order": current_user.user_id}}
    )

    # Ensure current_turn_index exists
    await db.games.update_one(
        {"game_id": game_id, "current_turn_index": {"$exists": False}},
        {"$set": {"current_turn_index": 0}}
    )

    # Check player count
    player_count = await db.game_players.count_documents({"game_id": game_id})
    
    # AUTO-START IF 2+ PLAYERS
    if player_count >= 2:
        await db.games.update_one(
            {"game_id": game_id},
            {"$set": {
                "status": "started",
                "current_hand": 1,
                "current_turn_index": 0,
                "turn_started_at": datetime.now(timezone.utc)
            }}
        )
        
        # Deal cards for first hand
        await deal_cards_for_hand(game_id, 1)
        
        # Notify players
        players = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
        for p in players:
            await create_notification(
                p["user_id"],
                "game_started",
                "Oyun Başladı!",
                "Kartlarınız dağıtıldı. Sıranız geldiğinde oynayın!",
                {"game_id": game_id}
            )
        
        return {"message": t("joined_game_auto_started", request)}
    
    return {"message": t("joined_game", request)}

@api_router.post("/games/{game_id}/start")
async def start_game(request: Request, game_id: str, current_user: User = Depends(get_current_user)):
    """Start the game (must have at least 2 players)"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["created_by"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only creator can start the game")
    
    if game["status"] not in ["waiting", "ready"]:
        raise HTTPException(status_code=400, detail="Game not ready to start")
    
    # Check player count
    player_count = await db.game_players.count_documents({"game_id": game_id})
    if player_count < 2:
        raise HTTPException(status_code=400, detail="En az 2 oyuncu gerekli!")
    
    # Update game status to 'started' with turn initialization
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {"status": "started", "current_hand": 1, "current_turn_index": 0, "turn_started_at": datetime.now(timezone.utc), "hand_started_at": datetime.now(timezone.utc)}}
    )
    
    # Deal cards for first hand
    await deal_cards_for_hand(game_id, 1)
    
    # Notify players
    players = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    for p in players:
        await create_notification(
            p["user_id"],
            "game_started",
            "Oyun Başladı!",
            "Kartlarınız dağıtıldı. Sıranız geldiğinde oynayın!",
            {"game_id": game_id}
        )
    
    return {"message": t("game_started", request), "hand": 1}

async def deal_cards_for_hand(game_id: str, hand_number: int):
    """Deal 3 cards to each player for a hand (3 hands: 1-2 normal, 3 penalty)"""
    players = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    
    # Determine card deck based on hand number
    if hand_number == 3:
        # Hand 3: Penalty cards only
        deck_types = ["ceza"]
    else:
        # Hands 1-2: Normal cards
        deck_types = ["komik", "sosyal", "beceri", "cevre"]
    
    all_cards = await db.cards.find({"deck_type": {"$in": deck_types}}, {"_id": 0}).to_list(1000)
    penalty_cards = []
    if hand_number in [1, 2]:
        penalty_cards = await db.cards.find({"deck_type": "ceza"}, {"_id": 0}).to_list(1000)
    
    for player in players:
        # Shuffle and pick 3 random cards
        random.shuffle(all_cards)
        if hand_number in [1, 2] and penalty_cards:
            random.shuffle(penalty_cards)
            normal_pick = random.sample(all_cards, min(2, len(all_cards)))
            penalty_pick = random.sample(penalty_cards, 1)
            player_cards = normal_pick + penalty_pick
            random.shuffle(player_cards)
        else:
            player_cards = random.sample(all_cards, min(3, len(all_cards)))
        
        for card in player_cards:
            hand_card = {
                "hand_card_id": f"hc_{uuid.uuid4().hex[:12]}",
                "game_id": game_id,
                "hand_number": hand_number,
                "user_id": player["user_id"],
                "card_id": card["card_id"],
                "status": "in_hand",
                "selected": False
            }
            await db.hand_cards.insert_one(hand_card)

@api_router.get("/games/{game_id}")
async def get_game(game_id: str, current_user: User = Depends(get_current_user)):
    """Get game details"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get players with user info
    players_data = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    players = []
    for p in players_data:
        user = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
        if user:
            players.append({
                **p,
                "name": user["name"],
                "picture": user.get("picture"),
                "player_id": user["player_id"]
            })
    
    game["players"] = players
    return game

@api_router.get("/games/{game_id}/my-cards")
async def get_my_cards(game_id: str, current_user: User = Depends(get_current_user)):
    """Get current player's cards for the active hand"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Get player entry
    player_entry = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    if not player_entry:
        raise HTTPException(status_code=403, detail="Not in this game")
    
    # Get hand cards
    hand_cards = await db.hand_cards.find({
        "game_id": game_id,
        "hand_number": game["current_hand"],
        "user_id": current_user.user_id,
        "status": "in_hand"
    }, {"_id": 0}).to_list(10)
    
    # Enrich with card details
    cards = []
    for hc in hand_cards:
        card = await db.cards.find_one({"card_id": hc["card_id"]}, {"_id": 0})
        if card:
            cards.append({
                "hand_card_id": hc["hand_card_id"],
                "card": card,
                "selected": bool(hc.get("selected", False))
            })
    
    # Calculate remaining hand time (60 seconds per hand)
    hand_time_remaining = 60
    hand_started = game.get("hand_started_at")
    if hand_started:
        if hand_started.tzinfo is None:
            hand_started = hand_started.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - hand_started).total_seconds()
        hand_time_remaining = max(0, int(60 - elapsed))
    
    return {
        "cards": cards,
        "pass_used": player_entry["pass_used"],
        "swap_used": player_entry["swap_used"],
        "current_hand": game["current_hand"],
        "hand_time_remaining": hand_time_remaining
    }


@api_router.post("/games/{game_id}/select")
async def select_card(request: Request, game_id: str, req: SelectCardRequest, current_user: User = Depends(get_current_user)):
    """Select one of the 3 cards for the current hand"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if game["status"] != "started":
        raise HTTPException(status_code=400, detail="Game not started")

    player_entry = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    if not player_entry:
        raise HTTPException(status_code=403, detail="Not in this game")

    hand_number = game.get("current_hand", 1)

    # Ensure the card exists in user's current hand
    existing = await db.hand_cards.find_one({
        "game_id": game_id,
        "hand_number": hand_number,
        "user_id": current_user.user_id,
        "card_id": req.card_id,
        "status": "in_hand"
    }, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Card not in hand")

    # Unselect all, then select the requested one
    await db.hand_cards.update_many({
        "game_id": game_id,
        "hand_number": hand_number,
        "user_id": current_user.user_id,
        "status": "in_hand"
    }, {"$set": {"selected": False}})

    await db.hand_cards.update_one({
        "game_id": game_id,
        "hand_number": hand_number,
        "user_id": current_user.user_id,
        "card_id": req.card_id,
        "status": "in_hand"
    }, {"$set": {"selected": True}})

    return {"selected_card_id": req.card_id}

@api_router.post("/games/{game_id}/play")
async def play_card(request: Request, game_id: str, req: PlayCardRequest, current_user: User = Depends(get_current_user)):
    """Play a card: play, pass, or refuse"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "started":
        raise HTTPException(status_code=400, detail="Game not started")
    
    player_entry = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    if not player_entry:
        raise HTTPException(status_code=403, detail="Not in this game")
    
    # Enforce turn order: only current player can act
    turn_order = game.get("turn_order", [])
    if turn_order:
        current_idx = game.get("current_turn_index", 0) or 0
        # guard against empty turn_order
        if len(turn_order) > 0:
            current_player_id = turn_order[current_idx % len(turn_order)]
            if current_player_id != current_user.user_id:
                raise HTTPException(status_code=400, detail="Not your turn")

    # CHECK HAND TIME LIMIT (60 seconds per hand - auto pass if exceeded)
    now = datetime.now(timezone.utc)
    hand_started = game.get("hand_started_at")
    if hand_started:
        if hand_started.tzinfo is None:
            hand_started = hand_started.replace(tzinfo=timezone.utc)
        hand_elapsed = (now - hand_started).total_seconds()
        if hand_elapsed > 60:
            raise HTTPException(status_code=400, detail="Hand time limit exceeded - time to move to next hand")
    
    # Find the hand card
    hand_card = await db.hand_cards.find_one({
        "game_id": game_id,
        "hand_number": game["current_hand"],
        "user_id": current_user.user_id,
        "card_id": req.card_id,
        "status": "in_hand"
    })
    if not hand_card:
        raise HTTPException(status_code=404, detail="Card not in hand")

    # If user has a selected card, enforce playing only that card
    selected_any = await db.hand_cards.find_one({
        "game_id": game_id,
        "hand_number": game["current_hand"],
        "user_id": current_user.user_id,
        "status": "in_hand",
        "selected": True
    }, {"_id": 0})
    if selected_any and selected_any.get("card_id") != req.card_id:
        raise HTTPException(status_code=400, detail="You must play the selected card")
    
    if req.action == "play":
        # Create submission
        submission = {
            "submission_id": f"sub_{uuid.uuid4().hex[:12]}",
            "game_id": game_id,
            "hand_number": game["current_hand"],
            "user_id": current_user.user_id,
            "card_id": req.card_id,
            "photo_base64": req.photo_base64,
            "note": req.note,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "votes_approve": 0,
            "votes_reject": 0
        }
        await db.submissions.insert_one(submission)
        
        # Update card status
        await db.hand_cards.update_one(
            {"hand_card_id": hand_card["hand_card_id"]},
            {"$set": {"status": "played"}}
        )

        # Discard any other remaining cards for this player in this hand
        await db.hand_cards.update_many(
            {
                "game_id": game_id,
                "hand_number": game["current_hand"],
                "user_id": current_user.user_id,
                "status": "in_hand",
                "card_id": {"$ne": req.card_id}
            },
            {"$set": {"status": "discarded", "selected": False}}
        )
        
        # Create chat message
        card = await db.cards.find_one({"card_id": req.card_id}, {"_id": 0})
        await create_chat_message(
            game_id,
            current_user.user_id,
            f"{current_user.name} görevi tamamladı: {card['title']}",
            "submission",
            submission["submission_id"]
        )
        
        # Notify other players to vote
        players = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
        for p in players:
            if p["user_id"] != current_user.user_id:
                await create_notification(
                    p["user_id"],
                    "vote_needed",
                    "Oylama Zamanı",
                    f"{current_user.name} görevini tamamladı. Oyla!",
                    {"submission_id": submission["submission_id"], "game_id": game_id}
                )
        
        # Advance turn
        turn_order = game.get("turn_order", [])
        if turn_order:
            next_index = (game.get("current_turn_index", 0) + 1) % len(turn_order)
            await db.games.update_one(
                {"game_id": game_id},
                {"$set": {"current_turn_index": next_index, "turn_started_at": datetime.now(timezone.utc)}}
            )
        
        # CHECK IF HAND SHOULD AUTO-ADVANCE (2+ players submitted)
        await check_hand_completion(game_id)
        
        return {"message": t("card_played", request), "submission_id": submission["submission_id"]}
    
    elif req.action == "pass":
        if player_entry["pass_used"]:
            raise HTTPException(status_code=400, detail="Pass already used")
        
        await db.game_players.update_one(
            {"player_entry_id": player_entry["player_entry_id"]},
            {"$set": {"pass_used": True}}
        )
        
        await db.hand_cards.update_one(
            {"hand_card_id": hand_card["hand_card_id"]},
            {"$set": {"status": "passed"}}
        )

        # Discard any other remaining cards for this player in this hand
        await db.hand_cards.update_many(
            {
                "game_id": game_id,
                "hand_number": game["current_hand"],
                "user_id": current_user.user_id,
                "status": "in_hand"
            },
            {"$set": {"status": "discarded", "selected": False}}
        )
        
        await create_chat_message(
            game_id,
            current_user.user_id,
            f"{current_user.name} pas geçti.",
            "system"
        )
        
        # Advance turn
        turn_order = game.get("turn_order", [])
        if turn_order:
            next_index = (game.get("current_turn_index", 0) + 1) % len(turn_order)
            await db.games.update_one(
                {"game_id": game_id},
                {"$set": {"current_turn_index": next_index, "turn_started_at": datetime.now(timezone.utc)}}
            )

        # Check hand completion (may auto-advance if everyone finished and votes resolved)
        await check_hand_completion(game_id)

        return {"message": t("passed", request)}
    
    elif req.action == "refuse":
        # Player refuses the card and immediately receives a penalty card
        penalty_card = await get_random_penalty_card()

        penalty = {
            "penalty_id": f"pen_{uuid.uuid4().hex[:12]}",
            "game_id": game_id,
            "user_id": current_user.user_id,
            "card_id": penalty_card["card_id"] if isinstance(penalty_card, dict) else penalty_card.get("card_id"),
            "reason": "refuse",
            "created_at": datetime.now(timezone.utc)
        }
        await db.penalties.insert_one(penalty)

        # Mark the hand card as discarded
        await db.hand_cards.update_one(
            {"hand_card_id": hand_card["hand_card_id"]},
            {"$set": {"status": "discarded"}}
        )

        # Discard any other remaining cards for this player in this hand
        await db.hand_cards.update_many(
            {
                "game_id": game_id,
                "hand_number": game["current_hand"],
                "user_id": current_user.user_id,
                "status": "in_hand"
            },
            {"$set": {"status": "discarded", "selected": False}}
        )

        await create_chat_message(
            game_id,
            current_user.user_id,
            f"{current_user.name} kartı reddetti. Ceza: {penalty_card['title']}",
            "system"
        )

        # Advance turn after refuse
        turn_order = game.get("turn_order", [])
        if turn_order:
            next_index = (game.get("current_turn_index", 0) + 1) % len(turn_order)
            await db.games.update_one(
                {"game_id": game_id},
                {"$set": {"current_turn_index": next_index, "turn_started_at": datetime.now(timezone.utc)}}
            )

        # Check hand completion
        await check_hand_completion(game_id)

        return {"message": t("rejected", request), "penalty_card": penalty_card}

    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@api_router.post("/games/{game_id}/swap")
async def swap_card(request: Request, game_id: str, req: SwapCardRequest, current_user: User = Depends(get_current_user)):
    """Swap a card (one time per game)"""
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "started":
        raise HTTPException(status_code=400, detail="Game not started")
    
    player_entry = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    }, {"_id": 0})
    if not player_entry:
        raise HTTPException(status_code=403, detail="Not in this game")
    
    if player_entry["swap_used"]:
        raise HTTPException(status_code=400, detail="Swap already used")
    
    # Find and remove the old card
    hand_card = await db.hand_cards.find_one({
        "game_id": game_id,
        "hand_number": game["current_hand"],
        "user_id": current_user.user_id,
        "card_id": req.card_id,
        "status": "in_hand"
    })
    if not hand_card:
        raise HTTPException(status_code=404, detail="Card not in hand")
    
    await db.hand_cards.delete_one({"hand_card_id": hand_card["hand_card_id"]})
    
    # Get a new random card
    deck_types = ["komik", "sosyal", "beceri", "cevre"]
    new_card = await db.cards.aggregate([
        {"$match": {"deck_type": {"$in": deck_types}, "card_id": {"$ne": req.card_id}}},
        {"$sample": {"size": 1}}
    ]).to_list(1)
    
    if new_card:
        new_hand_card = {
            "hand_card_id": f"hc_{uuid.uuid4().hex[:12]}",
            "game_id": game_id,
            "hand_number": game["current_hand"],
            "user_id": current_user.user_id,
            "card_id": new_card[0]["card_id"],
            "status": "in_hand"
        }
        await db.hand_cards.insert_one(new_hand_card)
    
    # Mark swap as used
    await db.game_players.update_one(
        {"player_entry_id": player_entry["player_entry_id"]},
        {"$set": {"swap_used": True}}
    )
    
    return {"message": t("card_swapped", request), "new_card": new_card[0] if new_card else None}

async def get_random_penalty_card():
    """Get a random penalty card"""
    penalty_cards = await db.cards.aggregate([
        {"$match": {"deck_type": "ceza"}},
        {"$sample": {"size": 1}}
    ]).to_list(1)
    
    if penalty_cards:
        # remove Mongo internal _id to keep result JSON-serializable
        penalty_cards[0].pop("_id", None)
        return penalty_cards[0]
    return {"card_id": "default_penalty", "title": "Ceza", "description": "Özür dile!", "deck_type": "ceza"}


async def check_hand_completion(game_id: str):
    """Check whether the current hand is complete (no remaining in-hand cards).
    If complete, advance to next hand or finish the game. Deals cards for next hand.
    """
    game = await db.games.find_one({"game_id": game_id}, {"_id": 0})
    if not game:
        return

    current_hand = game.get("current_hand", 1)

    # Count remaining in-hand cards for current hand
    remaining = await db.hand_cards.count_documents({
        "game_id": game_id,
        "hand_number": current_hand,
        "status": "in_hand"
    })

    if remaining > 0:
        return

    # Do not advance while there are pending submissions in this hand
    pending_subs = await db.submissions.count_documents({
        "game_id": game_id,
        "hand_number": current_hand,
        "status": "pending"
    })
    if pending_subs > 0:
        return

    # Advance to next hand
    next_hand = current_hand + 1
    now = datetime.now(timezone.utc)

    if next_hand > 3:
        # Finish game
        await db.games.update_one(
            {"game_id": game_id},
            {"$set": {"status": "finished", "finished_at": now}}
        )

        # Award coins: winner +20, losers +5
        players = await db.game_players.find({"game_id": game_id}, {"_id": 0}).to_list(100)
        if players:
            # determine top score
            top_score = max(p.get("score", 0) for p in players)
            # award coins and log transactions
            for p in players:
                user_id = p.get("user_id")
                if user_id is None:
                    continue
                if p.get("score", 0) == top_score:
                    amt = 20
                    reason = "game_win"
                else:
                    amt = 5
                    reason = "game_participation"

                # atomic increment
                await db.users.update_one({"user_id": user_id}, {"$inc": {"coins": amt}})

                tx = {
                    "transaction_id": f"ct_{uuid.uuid4().hex[:12]}",
                    "user_id": user_id,
                    "amount": amt,
                    "reason": reason,
                    "game_id": game_id,
                    "created_at": datetime.utcnow()
                }
                await db.coin_transactions.insert_one(tx)

        # Announce finish
        creator = game.get("created_by") or "system"
        await create_chat_message(game_id, creator, f"Oyun bitti. El {current_hand} tamamlandı.", "system")
        return

    # Move to next hand and deal cards
    await db.games.update_one(
        {"game_id": game_id},
        {"$set": {"current_hand": next_hand, "current_turn_index": 0, "hand_started_at": now, "turn_started_at": now}}
    )

    # Deal cards for next hand
    await deal_cards_for_hand(game_id, next_hand)

    # Announce new hand
    creator = game.get("created_by") or "system"
    await create_chat_message(game_id, creator, f"El {next_hand} başladı.", "system")

# ==================== VOTING ENDPOINTS ====================

VOTE_TIMEOUT_SECONDS = int(os.environ.get("VOTE_TIMEOUT_SECONDS", "60"))
MIN_VOTES_REQUIRED = int(os.environ.get("MIN_VOTES_REQUIRED", "2"))

async def resolve_submission(submission_id: str) -> Optional[dict]:
    submission = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not submission:
        return None

    if submission.get("status") != "pending":
        return submission

    player_count = await db.game_players.count_documents({"game_id": submission["game_id"]})
    eligible_voters = max(0, int(player_count) - 1)

    votes_approve = int(submission.get("votes_approve", 0))
    votes_reject = int(submission.get("votes_reject", 0))
    votes_total = votes_approve + votes_reject

    min_required = min(MIN_VOTES_REQUIRED, eligible_voters) if eligible_voters > 0 else 0
    majority_needed = (eligible_voters // 2) + 1 if eligible_voters > 0 else 1

    created_at = submission.get("created_at")
    if created_at and getattr(created_at, "tzinfo", None) is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    timed_out = False
    if created_at:
        timed_out = (now - created_at).total_seconds() >= VOTE_TIMEOUT_SECONDS

    should_approve = votes_approve >= majority_needed
    should_reject = votes_reject >= majority_needed

    if not should_approve and not should_reject:
        if eligible_voters > 0 and votes_total >= eligible_voters:
            if votes_approve > votes_reject:
                should_approve = True
            else:
                should_reject = True
        elif timed_out:
            if votes_total == 0:
                should_reject = True
            elif votes_total >= min_required:
                if votes_approve > votes_reject:
                    should_approve = True
                else:
                    should_reject = True

    if not should_approve and not should_reject:
        return submission

    if should_approve:
        await db.submissions.update_one(
            {"submission_id": submission_id, "status": "pending"},
            {"$set": {"status": "approved"}}
        )

        card = await db.cards.find_one({"card_id": submission["card_id"]}, {"_id": 0})
        points = card.get("points", 1) if card else 1

        await db.game_players.update_one(
            {"game_id": submission["game_id"], "user_id": submission["user_id"]},
            {"$inc": {"score": points}}
        )

        await db.users.update_one(
            {"user_id": submission["user_id"]},
            {"$inc": {"weekly_score": points, "total_score": points}}
        )

        await create_chat_message(
            submission["game_id"],
            submission["user_id"],
            f"Görev onaylandı! +{points} puan",
            "system"
        )

        await check_hand_completion(submission["game_id"])
        return await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})

    await db.submissions.update_one(
        {"submission_id": submission_id, "status": "pending"},
        {"$set": {"status": "rejected"}}
    )

    penalty_card = await get_random_penalty_card()
    penalty = {
        "penalty_id": f"pen_{uuid.uuid4().hex[:12]}",
        "game_id": submission["game_id"],
        "user_id": submission["user_id"],
        "card_id": penalty_card["card_id"],
        "reason": "rejected",
        "created_at": datetime.now(timezone.utc)
    }
    await db.penalties.insert_one(penalty)

    await create_chat_message(
        submission["game_id"],
        submission["user_id"],
        f"Görev reddedildi! Ceza kartı: {penalty_card['title']}",
        "system"
    )

    await check_hand_completion(submission["game_id"])
    return await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})

@api_router.get("/games/{game_id}/submissions")
async def get_game_submissions(game_id: str, current_user: User = Depends(get_current_user)):
    """Get pending submissions for voting"""
    pending_ids = await db.submissions.find({
        "game_id": game_id,
        "status": "pending"
    }, {"_id": 0, "submission_id": 1}).to_list(100)

    for s in pending_ids:
        sid = s.get("submission_id")
        if sid:
            await resolve_submission(sid)

    submissions = await db.submissions.find({
        "game_id": game_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    # Enrich with user and card info
    for sub in submissions:
        user = await db.users.find_one({"user_id": sub["user_id"]}, {"_id": 0})
        card = await db.cards.find_one({"card_id": sub["card_id"]}, {"_id": 0})
        sub["user"] = {"name": user["name"], "picture": user.get("picture")} if user else None
        sub["card"] = card
        
        # Check if current user already voted
        vote = await db.votes.find_one({
            "submission_id": sub["submission_id"],
            "voter_id": current_user.user_id
        })
        sub["my_vote"] = vote["vote_type"] if vote else None
    
    return submissions

@api_router.post("/submissions/{submission_id}/vote")
async def vote_on_submission(request: Request, submission_id: str, req: VoteRequest, current_user: User = Depends(get_current_user)):
    """Vote on a submission"""
    submission = await db.submissions.find_one({"submission_id": submission_id}, {"_id": 0})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    if submission["user_id"] == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot vote on your own submission")
    
    if submission["status"] != "pending":
        raise HTTPException(status_code=400, detail="Submission already processed")
    
    # Check if already voted
    existing_vote = await db.votes.find_one({
        "submission_id": submission_id,
        "voter_id": current_user.user_id
    })
    if existing_vote:
        raise HTTPException(status_code=400, detail="Already voted")
    
    # Create vote
    vote = {
        "vote_id": f"vote_{uuid.uuid4().hex[:12]}",
        "submission_id": submission_id,
        "voter_id": current_user.user_id,
        "vote_type": req.vote_type,
        "created_at": datetime.now(timezone.utc)
    }
    await db.votes.insert_one(vote)
    
    # Update vote counts
    if req.vote_type == "approve":
        await db.submissions.update_one(
            {"submission_id": submission_id},
            {"$inc": {"votes_approve": 1}}
        )
    else:
        await db.submissions.update_one(
            {"submission_id": submission_id},
            {"$inc": {"votes_reject": 1}}
        )

    updated = await resolve_submission(submission_id)
    if updated and updated.get("status") == "approved":
        return {"message": t("approved", request), "result": "approved"}
    if updated and updated.get("status") == "rejected":
        penalty_card = await get_random_penalty_card()
        return {"message": t("rejected", request), "result": "rejected", "penalty_card": penalty_card}

    return {"message": t("vote_recorded", request), "result": "pending"}

# ==================== CHAT ENDPOINTS ====================

async def create_chat_message(game_id: str, user_id: str, content: str, message_type: str = "text", submission_id: str = None):
    """Create a chat message"""
    message = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "game_id": game_id,
        "user_id": user_id,
        "content": content,
        "message_type": message_type,
        "submission_id": submission_id,
        "created_at": datetime.now(timezone.utc)
    }
    await db.chat_messages.insert_one(message)
    
    # Remove _id field before returning
    message.pop("_id", None)
    
    return message

@api_router.get("/games/{game_id}/chat")
async def get_chat_messages(game_id: str, current_user: User = Depends(get_current_user)):
    """Get chat messages for a game"""
    messages = await db.chat_messages.find(
        {"game_id": game_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # Reverse to get chronological order
    messages.reverse()
    
    # Enrich with user info
    for msg in messages:
        user = await db.users.find_one({"user_id": msg["user_id"]}, {"_id": 0})
        msg["user"] = {"name": user["name"], "picture": user.get("picture")} if user else None
        
        # Add submission info if present
        if msg.get("submission_id"):
            submission = await db.submissions.find_one({"submission_id": msg["submission_id"]}, {"_id": 0})
            if submission:
                card = await db.cards.find_one({"card_id": submission["card_id"]}, {"_id": 0})
                msg["submission"] = {
                    **submission,
                    "card": card
                }
    
    return messages

@api_router.post("/games/{game_id}/chat")
async def send_chat_message(game_id: str, req: SendMessageRequest, current_user: User = Depends(get_current_user)):
    """Send a chat message"""
    # Check if player is in game
    player = await db.game_players.find_one({
        "game_id": game_id,
        "user_id": current_user.user_id
    })
    if not player:
        raise HTTPException(status_code=403, detail="Not in this game")
    
    message = await create_chat_message(game_id, current_user.user_id, req.content, "text")
    return message

# ==================== NOTIFICATION ENDPOINTS ====================

async def create_notification(user_id: str, type: str, title: str, message: str, data: dict = None):
    """Create a notification"""
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": type,
        "title": title,
        "message": message,
        "data": data,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    # Remove _id field before returning
    notification.pop("_id", None)
    
    return notification

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    """Get user notifications"""
    notifications = await db.notifications.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    return notifications

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(request: Request, notification_id: str, current_user: User = Depends(get_current_user)):
    """Mark notification as read"""
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"message": t("marked_as_read", request)}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request, current_user: User = Depends(get_current_user)):
    """Mark all notifications as read"""
    await db.notifications.update_many(
        {"user_id": current_user.user_id},
        {"$set": {"read": True}}
    )
    return {"message": t("all_marked_as_read", request)}

# ==================== PENALTY ENDPOINTS ====================

@api_router.get("/games/{game_id}/penalties")
async def get_game_penalties(game_id: str, current_user: User = Depends(get_current_user)):
    """Get penalties for a game"""
    penalties = await db.penalties.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    
    for p in penalties:
        user = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
        card = await db.cards.find_one({"card_id": p["card_id"]}, {"_id": 0})
        p["user"] = {"name": user["name"]} if user else None
        p["card"] = card
    
    return penalties

# ==================== MAIN ROUTES ====================

@api_router.get("/")
async def root(request: Request):
    return {"message": t("api_info", request), "version": "1.0"}

@api_router.get("/health")
async def health(request: Request):
    return {"status": t("healthy", request)}

@app.get("/")
async def app_root():
    return {"service": "Kartlı Challenge API", "api": "/api", "docs": "/docs"}

@app.get("/health")
async def app_health():
    return {"status": "ok"}

# Include router
app.include_router(api_router)

# Coins router
try:
    from coins import router as coins_router
    app.include_router(coins_router)
except Exception:
    # import errors will be visible during runtime; safe to ignore at import time
    pass

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    try:
        if db is None:
            raise RuntimeError("Missing required env vars: MONGO_URL and/or DB_NAME")
        await db.command("ping")
        await initialize_decks()
        logger.info("Application started, decks initialized")
    except Exception:
        logger.exception("Startup failed")
        raise

@app.on_event("shutdown")
async def shutdown_db_client():
    if client is not None:
        client.close()
