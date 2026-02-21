#!/usr/bin/env python3
"""
Backend API Testing for Kartlı Challenge Game
Testing the updated game flow with new join system
"""

import requests
import json
import time
import subprocess
import sys
from datetime import datetime

# Get backend URL from frontend .env
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return "http://localhost:8001"

BASE_URL = get_backend_url()
API_BASE = f"{BASE_URL}/api"

print(f"Testing backend at: {API_BASE}")

class TestResultsTracker:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def success(self, test_name):
        print(f"✅ {test_name}")
        self.passed += 1
    
    def fail(self, test_name, error):
        print(f"❌ {test_name}: {error}")
        self.failed += 1
        self.errors.append(f"{test_name}: {error}")
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n=== TEST SUMMARY ===")
        print(f"Total: {total}, Passed: {self.passed}, Failed: {self.failed}")
        if self.errors:
            print("\nFAILED TESTS:")
            for error in self.errors:
                print(f"  - {error}")
        return self.failed == 0

def setup_test_data():
    """Setup test users and friendship using MongoDB"""
    print("\n=== SETTING UP TEST DATA ===")
    
    # Generate unique IDs
    timestamp = int(time.time())
    user1_id = f"user_admin_{timestamp}"
    user2_id = f"user_friend_{timestamp}"
    token1 = f"admin_token_{timestamp}"
    token2 = f"friend_token_{timestamp}"
    
    mongo_script = f"""
var user1Id = '{user1_id}';
var user2Id = '{user2_id}';
var token1 = '{token1}';
var token2 = '{token2}';

// Create admin user
db.users.insertOne({{
  user_id: user1Id,
  email: 'admin@test.com',
  name: 'Admin User',
  player_id: 'PLRADMIN1',
  created_at: new Date(),
  weekly_score: 0,
  total_score: 0
}});

// Create friend user (NOT in group yet)
db.users.insertOne({{
  user_id: user2Id,
  email: 'friend@test.com', 
  name: 'Friend User',
  player_id: 'PLRFRND2',
  created_at: new Date(),
  weekly_score: 0,
  total_score: 0
}});

// Create sessions
db.user_sessions.insertOne({{
  user_id: user1Id,
  session_token: token1,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

db.user_sessions.insertOne({{
  user_id: user2Id,
  session_token: token2,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
}});

// Make them friends
db.friends.insertOne({{
  friendship_id: 'fr_test_' + Date.now(),
  user1_id: user1Id,
  user2_id: user2Id,
  created_at: new Date()
}});

print('TOKEN1 (admin): ' + token1);
print('TOKEN2 (friend): ' + token2);
print('USER1_ID: ' + user1Id);
print('USER2_ID: ' + user2Id);
"""
    
    try:
        result = subprocess.run([
            'mongosh', 'test_database', '--eval', mongo_script
        ], capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            print(f"MongoDB setup failed: {result.stderr}")
            return None
            
        output_lines = result.stdout.strip().split('\n')
        tokens = {}
        for line in output_lines:
            if 'TOKEN1 (admin):' in line:
                tokens['admin_token'] = line.split(': ')[1].strip()
            elif 'TOKEN2 (friend):' in line:
                tokens['friend_token'] = line.split(': ')[1].strip()
            elif 'USER1_ID:' in line:
                tokens['admin_user_id'] = line.split(': ')[1].strip()
            elif 'USER2_ID:' in line:
                tokens['friend_user_id'] = line.split(': ')[1].strip()
        
        print(f"✅ Test data created successfully")
        print(f"Admin token: {tokens.get('admin_token', 'NOT_FOUND')}")
        print(f"Friend token: {tokens.get('friend_token', 'NOT_FOUND')}")
        
        return tokens
        
    except Exception as e:
        print(f"❌ Failed to setup test data: {e}")
        return None

def test_game_flow_with_join_system():
    """Test the complete game flow with new join system"""
    results = TestResultsTracker()
    
    # Setup test data
    test_data = setup_test_data()
    if not test_data:
        results.fail("Setup", "Failed to create test data")
        return results
    
    admin_token = test_data['admin_token']
    friend_token = test_data['friend_token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    friend_headers = {'Authorization': f'Bearer {friend_token}'}
    
    group_id = None
    game_id = None
    invite_code = None
    notification_id = None
    
    try:
        # Test 1: Admin creates group
        print("\n=== TEST 1: Admin creates group ===")
        response = requests.post(f"{API_BASE}/groups", 
                               json={"name": "Test Game Group"}, 
                               headers=admin_headers)
        
        if response.status_code == 200:
            data = response.json()
            group_id = data['group']['group_id']
            invite_code = data['group']['invite_code']
            results.success("Admin creates group")
            print(f"Group ID: {group_id}")
            print(f"Invite Code: {invite_code}")
        else:
            results.fail("Admin creates group", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 2: Admin creates game (triggers invites to friends)
        print("\n=== TEST 2: Admin creates game ===")
        response = requests.post(f"{API_BASE}/games", 
                               json={"group_id": group_id}, 
                               headers=admin_headers)
        
        if response.status_code == 200:
            data = response.json()
            game_id = data['game_id']
            results.success("Admin creates game")
            print(f"Game ID: {game_id}")
        else:
            results.fail("Admin creates game", f"Status {response.status_code}: {response.text}")
            return results
        
        # Wait a moment for notifications to be created
        time.sleep(1)
        
        # Test 3: Check friend received notification
        print("\n=== TEST 3: Check friend received notification ===")
        response = requests.get(f"{API_BASE}/notifications", headers=friend_headers)
        
        if response.status_code == 200:
            notifications = response.json()
            game_invite_notif = None
            
            for notif in notifications:
                if (notif.get('type') == 'game_invite' and 
                    notif.get('data', {}).get('action') == 'join_group_and_game'):
                    game_invite_notif = notif
                    notification_id = notif['notification_id']
                    break
            
            if game_invite_notif:
                results.success("Friend received game invite notification")
                print(f"Notification ID: {notification_id}")
                print(f"Notification data: {game_invite_notif.get('data')}")
            else:
                results.fail("Friend received notification", "No game_invite notification with join_group_and_game action found")
                print(f"Available notifications: {[n.get('type') for n in notifications]}")
                return results
        else:
            results.fail("Friend received notification", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 4: Friend accepts invite via notification
        print("\n=== TEST 4: Friend accepts invite via notification ===")
        response = requests.post(f"{API_BASE}/notifications/{notification_id}/accept-invite", 
                               headers=friend_headers)
        
        if response.status_code == 200:
            data = response.json()
            results.success("Friend accepts invite via notification")
            print(f"Response: {data}")
        else:
            results.fail("Friend accepts invite", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 5: Verify friend is in group
        print("\n=== TEST 5: Verify friend is in group ===")
        response = requests.get(f"{API_BASE}/groups/{group_id}", headers=friend_headers)
        
        if response.status_code == 200:
            group_data = response.json()
            friend_in_group = any(member['user_id'] == test_data['friend_user_id'] 
                                for member in group_data.get('members', []))
            
            if friend_in_group:
                results.success("Friend is in group")
                print(f"Group members: {len(group_data.get('members', []))}")
            else:
                results.fail("Friend is in group", "Friend not found in group members")
                return results
        else:
            results.fail("Friend is in group", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 6: Verify friend is in game
        print("\n=== TEST 6: Verify friend is in game ===")
        response = requests.get(f"{API_BASE}/games/{game_id}", headers=friend_headers)
        
        if response.status_code == 200:
            game_data = response.json()
            friend_in_game = any(player['user_id'] == test_data['friend_user_id'] 
                               for player in game_data.get('players', []))
            
            if friend_in_game:
                results.success("Friend is in game")
                print(f"Game players: {len(game_data.get('players', []))}")
            else:
                results.fail("Friend is in game", "Friend not found in game players")
                return results
        else:
            results.fail("Friend is in game", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 7: Admin starts the game
        print("\n=== TEST 7: Admin starts the game ===")
        response = requests.post(f"{API_BASE}/games/{game_id}/start", headers=admin_headers)
        
        if response.status_code == 200:
            data = response.json()
            results.success("Admin starts the game")
            print(f"Game started: {data}")
        else:
            results.fail("Admin starts the game", f"Status {response.status_code}: {response.text}")
            return results
        
        # Test 8: Test active_game info in group details
        print("\n=== TEST 8: Test active_game info in group details ===")
        response = requests.get(f"{API_BASE}/groups/{group_id}", headers=admin_headers)
        
        if response.status_code == 200:
            group_data = response.json()
            active_game = group_data.get('active_game')
            
            if active_game:
                expected_fields = ['status', 'player_count', 'is_player']
                missing_fields = [field for field in expected_fields if field not in active_game]
                
                if not missing_fields:
                    results.success("Active game info in group details")
                    print(f"Active game status: {active_game.get('status')}")
                    print(f"Player count: {active_game.get('player_count')}")
                    print(f"Is player: {active_game.get('is_player')}")
                else:
                    results.fail("Active game info", f"Missing fields: {missing_fields}")
            else:
                results.fail("Active game info", "No active_game found in group details")
        else:
            results.fail("Active game info", f"Status {response.status_code}: {response.text}")
        
    except Exception as e:
        results.fail("Game flow test", f"Exception: {str(e)}")
    
    assert results.failed == 0, f"Test failures: {results.errors}"

def test_notifications_system():
    """Test notifications system endpoints"""
    results = TestResultsTracker()
    
    # Setup test data
    test_data = setup_test_data()
    if not test_data:
        results.fail("Setup", "Failed to create test data")
        return results
    
    admin_token = test_data['admin_token']
    friend_token = test_data['friend_token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    friend_headers = {'Authorization': f'Bearer {friend_token}'}
    
    try:
        # Test GET /notifications
        print("\n=== Testing GET /notifications ===")
        response = requests.get(f"{API_BASE}/notifications", headers=admin_headers)
        
        if response.status_code == 200:
            notifications = response.json()
            results.success("GET /notifications")
            print(f"Retrieved {len(notifications)} notifications")
        else:
            results.fail("GET /notifications", f"Status {response.status_code}: {response.text}")
        
        # Test mark all notifications as read
        print("\n=== Testing POST /notifications/read-all ===")
        response = requests.post(f"{API_BASE}/notifications/read-all", headers=admin_headers)
        
        if response.status_code == 200:
            results.success("POST /notifications/read-all")
        else:
            results.fail("POST /notifications/read-all", f"Status {response.status_code}: {response.text}")
        
    except Exception as e:
        results.fail("Notifications system test", f"Exception: {str(e)}")
    
    assert results.failed == 0, f"Test failures: {results.errors}"

def test_chat_system():
    """Test chat system endpoints"""
    results = TestResultsTracker()
    
    # Setup test data
    test_data = setup_test_data()
    if not test_data:
        results.fail("Setup", "Failed to create test data")
        return results
    
    admin_token = test_data['admin_token']
    friend_token = test_data['friend_token']
    admin_headers = {'Authorization': f'Bearer {admin_token}'}
    friend_headers = {'Authorization': f'Bearer {friend_token}'}
    
    try:
        # Create a group and game first
        group_response = requests.post(f"{API_BASE}/groups", 
                                     json={"name": "Chat Test Group"}, 
                                     headers=admin_headers)
        
        if group_response.status_code != 200:
            results.fail("Chat system setup", "Failed to create group")
            return results
        
        group_id = group_response.json()['group']['group_id']
        
        game_response = requests.post(f"{API_BASE}/games", 
                                    json={"group_id": group_id}, 
                                    headers=admin_headers)
        
        if game_response.status_code != 200:
            results.fail("Chat system setup", "Failed to create game")
            return results
        
        game_id = game_response.json()['game_id']
        
        # Test GET /games/{game_id}/chat
        print("\n=== Testing GET /games/{game_id}/chat ===")
        response = requests.get(f"{API_BASE}/games/{game_id}/chat", headers=admin_headers)
        
        if response.status_code == 200:
            messages = response.json()
            results.success("GET /games/{game_id}/chat")
            print(f"Retrieved {len(messages)} chat messages")
        else:
            results.fail("GET /games/{game_id}/chat", f"Status {response.status_code}: {response.text}")
        
        # Test POST /games/{game_id}/chat
        print("\n=== Testing POST /games/{game_id}/chat ===")
        response = requests.post(f"{API_BASE}/games/{game_id}/chat", 
                               json={"content": "Test chat message"}, 
                               headers=admin_headers)
        
        if response.status_code == 200:
            message = response.json()
            results.success("POST /games/{game_id}/chat")
            print(f"Sent message: {message.get('content')}")
        else:
            results.fail("POST /games/{game_id}/chat", f"Status {response.status_code}: {response.text}")
        
    except Exception as e:
        results.fail("Chat system test", f"Exception: {str(e)}")
    
    assert results.failed == 0, f"Test failures: {results.errors}"

def main():
    """Main test runner"""
    print("=" * 60)
    print("KARTLI CHALLENGE - BACKEND API TESTING")
    print("=" * 60)
    
    all_results = TestResultsTracker()
    
    # Test 1: Game flow with join system (main focus)
    print("\n🎯 TESTING GAME FLOW WITH JOIN SYSTEM")
    game_flow_results = test_game_flow_with_join_system()
    all_results.passed += game_flow_results.passed
    all_results.failed += game_flow_results.failed
    all_results.errors.extend(game_flow_results.errors)
    
    # Test 2: Notifications system
    print("\n🔔 TESTING NOTIFICATIONS SYSTEM")
    notifications_results = test_notifications_system()
    all_results.passed += notifications_results.passed
    all_results.failed += notifications_results.failed
    all_results.errors.extend(notifications_results.errors)
    
    # Test 3: Chat system
    print("\n💬 TESTING CHAT SYSTEM")
    chat_results = test_chat_system()
    all_results.passed += chat_results.passed
    all_results.failed += chat_results.failed
    all_results.errors.extend(chat_results.errors)
    
    # Final summary
    success = all_results.summary()
    
    if success:
        print("\n🎉 ALL TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"\n💥 {all_results.failed} TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    main()