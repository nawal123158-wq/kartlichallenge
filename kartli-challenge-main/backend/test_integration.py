import os
import uuid
import time
from datetime import datetime, timedelta, timezone
import pymongo
import requests
from dotenv import load_dotenv

load_dotenv()
MONGO_URL = os.environ.get('MONGO_URL')
API_URL = 'http://127.0.0.1:5000/api'

if not MONGO_URL:
    print('MONGO_URL not set')
    exit(1)

client = pymongo.MongoClient(MONGO_URL)
db = client[os.environ.get('DB_NAME')]

now = datetime.now(timezone.utc)

# Create two users
u1 = {
    'user_id': f'u_{uuid.uuid4().hex[:8]}',
    'email': 'u1@example.com',
    'name': 'Alice',
    'player_id': f'player_{uuid.uuid4().hex[:6]}',
    'created_at': now,
    'weekly_score': 0,
    'total_score': 0
}

u2 = {
    'user_id': f'u_{uuid.uuid4().hex[:8]}',
    'email': 'u2@example.com',
    'name': 'Bob',
    'player_id': f'player_{uuid.uuid4().hex[:6]}',
    'created_at': now,
    'weekly_score': 0,
    'total_score': 0
}

# Insert users
print('Inserting users...')
db.users.insert_many([u1, u2])

# Create sessions
token1 = f'token_{uuid.uuid4().hex[:12]}'
token2 = f'token_{uuid.uuid4().hex[:12]}'

s1 = {
    'user_id': u1['user_id'],
    'session_token': token1,
    'expires_at': now + timedelta(days=1),
    'created_at': now
}
s2 = {
    'user_id': u2['user_id'],
    'session_token': token2,
    'expires_at': now + timedelta(days=1),
    'created_at': now
}

db.user_sessions.insert_many([s1, s2])
print('Inserted sessions:', token1, token2)

# Create group
group = {
    'group_id': f'g_{uuid.uuid4().hex[:8]}',
    'name': 'Test Group',
    'invite_code': f'code_{uuid.uuid4().hex[:6]}',
    'created_by': u1['user_id'],
    'created_at': now,
    'max_players': 10
}
db.groups.insert_one(group)

# Add group members
gm1 = {'membership_id': f'm_{uuid.uuid4().hex[:8]}', 'group_id': group['group_id'], 'user_id': u1['user_id'], 'joined_at': now, 'is_admin': True}
gm2 = {'membership_id': f'm_{uuid.uuid4().hex[:8]}', 'group_id': group['group_id'], 'user_id': u2['user_id'], 'joined_at': now, 'is_admin': False}
db.group_members.insert_many([gm1, gm2])

# Use API to create game as u1
headers1 = {'Authorization': f'Bearer {token1}'}
print('Creating game via API...')
resp = requests.post(f'{API_URL}/games', json={'group_id': group['group_id']}, headers=headers1)
print('create game status', resp.status_code, resp.text)
if resp.status_code != 200 and resp.status_code != 201:
    print('Failed to create game')
    exit(1)

game = resp.json()
print('Created game:', game['game_id'])

game_id = game['game_id']

# Have u2 join the game
headers2 = {'Authorization': f'Bearer {token2}'}
resp = requests.post(f'{API_URL}/games/{game_id}/join', headers=headers2)
print('u2 join status', resp.status_code, resp.text)

# Start game as u1
resp = requests.post(f'{API_URL}/games/{game_id}/start', headers=headers1)
print('start status', resp.status_code, resp.text)

# Wait a bit for dealing
time.sleep(1)

# Fetch game state
resp = requests.get(f'{API_URL}/games/{game_id}', headers=headers1)
print('game state', resp.status_code, resp.text)

g = resp.json()
print('turn_order', g.get('turn_order'), 'current_turn_index', g.get('current_turn_index'))

# Get my cards for u1
resp = requests.get(f'{API_URL}/games/{game_id}/my-cards', headers=headers1)
print('u1 my-cards', resp.status_code, resp.text)
cards1 = resp.json().get('cards', [])
if not cards1:
    print('No cards for u1, abort')
    exit(1)

card_to_use = cards1[0]['card']['card_id']
print('u1 will refuse card', card_to_use)

# u1 performs refuse
resp = requests.post(f'{API_URL}/games/{game_id}/play', json={'card_id': card_to_use, 'action': 'refuse'}, headers=headers1)
print('u1 refuse', resp.status_code, resp.text)

# Check penalties
resp = requests.get(f'{API_URL}/games/{game_id}/penalties', headers=headers1)
print('penalties', resp.status_code, resp.text)

# Check game to see current_turn_index advanced
resp = requests.get(f'{API_URL}/games/{game_id}', headers=headers1)
print('game after refuse', resp.status_code, resp.text)

print('TEST COMPLETE')

# --- Additional coin endpoint tests ---
print('\n-- Testing coins endpoints --')

# Check initial balances
resp = requests.get(f'{API_URL}/coins/me', headers=headers1)
print('u1 coins (before):', resp.status_code, resp.text)
resp = requests.get(f'{API_URL}/coins/me', headers=headers2)
print('u2 coins (before):', resp.status_code, resp.text)

# Reward u1 with 15 coins
resp = requests.post(f'{API_URL}/coins/reward', json={'amount': 15, 'reason': 'integration_test'}, headers=headers1)
print('reward u1:', resp.status_code, resp.text)

# Spend 5 coins from u1
resp = requests.post(f'{API_URL}/coins/spend', json={'amount': 5, 'reason': 'buy_something'}, headers=headers1)
print('spend u1:', resp.status_code, resp.text)

# Now simulate finishing the game: set current_hand to 3 and ensure no hand_cards for that hand
db.games.update_one({'game_id': game_id}, {'$set': {'current_hand': 3}})
db.hand_cards.delete_many({'game_id': game_id, 'hand_number': 3})

import asyncio
import server

print('\n-- Triggering check_hand_completion to finish game and award coins --')
asyncio.run(server.check_hand_completion(game_id))

# Give a moment
time.sleep(1)

# Check coins after finish
resp = requests.get(f'{API_URL}/coins/me', headers=headers1)
print('u1 coins (after finish):', resp.status_code, resp.text)
resp = requests.get(f'{API_URL}/coins/me', headers=headers2)
print('u2 coins (after finish):', resp.status_code, resp.text)

# Check coin_transactions
docs = list(db.coin_transactions.find({'game_id': game_id}, {'_id': 0}))
print('coin transactions for game:', docs)

print('\nINTEGRATION TEST COMPLETE')
