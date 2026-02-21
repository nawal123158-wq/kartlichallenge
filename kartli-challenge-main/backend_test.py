#!/usr/bin/env python3
"""
Kartlı Challenge Backend API Test Suite
Tests all backend endpoints with real test data
"""

import requests
import json
import sys
from datetime import datetime

# Test configuration
BASE_URL = "https://dare-challenge-7.preview.emergentagent.com/api"
TOKEN1 = "test_token_1_1771170054224"
TOKEN2 = "test_token_2_1771170054224"
PLAYER_ID1 = "PLRXW3K9N"
PLAYER_ID2 = "PLR83ERJ4"

# Test results tracking
test_results = []
failed_tests = []

def log_test(test_name, success, details=""):
    """Log test result"""
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} {test_name}")
    if details:
        print(f"   {details}")
    
    test_results.append({
        "test": test_name,
        "success": success,
        "details": details,
        "timestamp": datetime.now().isoformat()
    })
    
    if not success:
        failed_tests.append(test_name)

def make_request(method, endpoint, token=None, data=None):
    """Make HTTP request with proper headers"""
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method == "GET":
            response = requests.get(url, headers=headers, timeout=10)
        elif method == "POST":
            response = requests.post(url, headers=headers, json=data, timeout=10)
        elif method == "PUT":
            response = requests.put(url, headers=headers, json=data, timeout=10)
        elif method == "DELETE":
            response = requests.delete(url, headers=headers, timeout=10)
        
        return response
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
        return None

def run_auth_endpoints():
    """Test authentication endpoints"""
    print("\n=== TESTING AUTH ENDPOINTS ===")
    
    # Test /auth/me with token1
    response = make_request("GET", "/auth/me", TOKEN1)
    if response and response.status_code == 200:
        user_data = response.json()
        if user_data.get("email") == "test1@example.com":
            log_test("GET /auth/me (token1)", True, f"User: {user_data.get('name')}")
        else:
            log_test("GET /auth/me (token1)", False, f"Wrong user data: {user_data}")
    else:
        log_test("GET /auth/me (token1)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test /auth/me with token2
    response = make_request("GET", "/auth/me", TOKEN2)
    if response and response.status_code == 200:
        user_data = response.json()
        if user_data.get("email") == "test2@example.com":
            log_test("GET /auth/me (token2)", True, f"User: {user_data.get('name')}")
        else:
            log_test("GET /auth/me (token2)", False, f"Wrong user data: {user_data}")
    else:
        log_test("GET /auth/me (token2)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test /auth/check with token1
    response = make_request("GET", "/auth/check", TOKEN1)
    if response and response.status_code == 200:
        auth_data = response.json()
        if auth_data.get("authenticated") is True:
            log_test("GET /auth/check (token1)", True, "Authenticated successfully")
        else:
            log_test("GET /auth/check (token1)", False, f"Not authenticated: {auth_data}")
    else:
        log_test("GET /auth/check (token1)", False, f"Status: {response.status_code if response else 'No response'}")

def run_groups_system():
    """Test groups system"""
    print("\n=== TESTING GROUPS SYSTEM ===")
    
    # Create group with token1
    group_data = {"name": "Test Challenge Group"}
    response = make_request("POST", "/groups", TOKEN1, group_data)
    
    if response and response.status_code == 200:
        group_result = response.json()
        group_id = group_result.get("group", {}).get("group_id")
        invite_code = group_result.get("group", {}).get("invite_code")
        
        if group_id and invite_code:
            log_test("POST /groups (create)", True, f"Group ID: {group_id}, Invite: {invite_code}")
            
            # Test get groups
            response = make_request("GET", "/groups", TOKEN1)
            if response and response.status_code == 200:
                groups = response.json()
                if len(groups) > 0 and any(g.get("group_id") == group_id for g in groups):
                    log_test("GET /groups (list)", True, f"Found {len(groups)} groups")
                else:
                    log_test("GET /groups (list)", False, f"Group not found in list: {groups}")
            else:
                log_test("GET /groups (list)", False, f"Status: {response.status_code if response else 'No response'}")
            
            # Join group with token2
            join_data = {"invite_code": invite_code}
            response = make_request("POST", "/groups/join", TOKEN2, join_data)
            if response and response.status_code == 200:
                log_test("POST /groups/join (token2)", True, "Successfully joined group")
                return group_id, invite_code
            else:
                log_test("POST /groups/join (token2)", False, f"Status: {response.status_code if response else 'No response'}")
                return group_id, invite_code
        else:
            log_test("POST /groups (create)", False, f"Missing group data: {group_result}")
            return None, None
    else:
        log_test("POST /groups (create)", False, f"Status: {response.status_code if response else 'No response'}")
        return None, None

def run_game_system(group_id):
    """Test game system"""
    print("\n=== TESTING GAME SYSTEM ===")
    
    if not group_id:
        log_test("Game System", False, "No group_id available")
        return None
    
    # Create game
    game_data = {"group_id": group_id}
    response = make_request("POST", "/games", TOKEN1, game_data)
    
    if response and response.status_code == 200:
        game_result = response.json()
        game_id = game_result.get("game_id")
        
        if game_id:
            log_test("POST /games (create)", True, f"Game ID: {game_id}")
            
            # Join game with token2
            response = make_request("POST", f"/games/{game_id}/join", TOKEN2)
            if response and response.status_code == 200:
                log_test("POST /games/{game_id}/join (token2)", True, "Successfully joined game")
                
                # Start game with token1 (creator)
                response = make_request("POST", f"/games/{game_id}/start", TOKEN1)
                if response and response.status_code == 200:
                    log_test("POST /games/{game_id}/start", True, "Game started successfully")
                    return game_id
                else:
                    log_test("POST /games/{game_id}/start", False, f"Status: {response.status_code if response else 'No response'}")
                    return game_id
            else:
                log_test("POST /games/{game_id}/join (token2)", False, f"Status: {response.status_code if response else 'No response'}")
                return game_id
        else:
            log_test("POST /games (create)", False, f"No game_id in response: {game_result}")
            return None
    else:
        log_test("POST /games (create)", False, f"Status: {response.status_code if response else 'No response'}")
        return None

def run_card_system(game_id):
    """Test card dealing and retrieval"""
    print("\n=== TESTING CARD SYSTEM ===")
    
    if not game_id:
        log_test("Card System", False, "No game_id available")
        return None, None
    
    # Get cards for token1
    response = make_request("GET", f"/games/{game_id}/my-cards", TOKEN1)
    if response and response.status_code == 200:
        cards_data = response.json()
        cards1 = cards_data.get("cards", [])
        if len(cards1) == 5:
            log_test("GET /games/{game_id}/my-cards (token1)", True, f"Got {len(cards1)} cards")
            card1_id = cards1[0].get("card", {}).get("card_id") if cards1 else None
        else:
            log_test("GET /games/{game_id}/my-cards (token1)", False, f"Expected 5 cards, got {len(cards1)}")
            card1_id = cards1[0].get("card", {}).get("card_id") if cards1 else None
    else:
        log_test("GET /games/{game_id}/my-cards (token1)", False, f"Status: {response.status_code if response else 'No response'}")
        card1_id = None
    
    # Get cards for token2
    response = make_request("GET", f"/games/{game_id}/my-cards", TOKEN2)
    if response and response.status_code == 200:
        cards_data = response.json()
        cards2 = cards_data.get("cards", [])
        if len(cards2) == 5:
            log_test("GET /games/{game_id}/my-cards (token2)", True, f"Got {len(cards2)} cards")
            card2_id = cards2[0].get("card", {}).get("card_id") if cards2 else None
        else:
            log_test("GET /games/{game_id}/my-cards (token2)", False, f"Expected 5 cards, got {len(cards2)}")
            card2_id = cards2[0].get("card", {}).get("card_id") if cards2 else None
    else:
        log_test("GET /games/{game_id}/my-cards (token2)", False, f"Status: {response.status_code if response else 'No response'}")
        card2_id = None
    
    return card1_id, card2_id

def run_play_and_vote_system(game_id, card1_id, card2_id):
    """Test playing cards and voting system"""
    print("\n=== TESTING PLAY AND VOTE SYSTEM ===")
    
    if not game_id or not card1_id:
        log_test("Play and Vote System", False, "Missing game_id or card_id")
        return
    
    # Play card with token1
    play_data = {
        "card_id": card1_id,
        "action": "play",
        "photo_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A"
    }
    response = make_request("POST", f"/games/{game_id}/play", TOKEN1, play_data)
    
    if response and response.status_code == 200:
        play_result = response.json()
        submission_id = play_result.get("submission_id")
        
        if submission_id:
            log_test("POST /games/{game_id}/play (token1)", True, f"Submission ID: {submission_id}")
            
            # Get submissions for voting
            response = make_request("GET", f"/games/{game_id}/submissions", TOKEN2)
            if response and response.status_code == 200:
                submissions = response.json()
                if len(submissions) > 0 and any(s.get("submission_id") == submission_id for s in submissions):
                    log_test("GET /games/{game_id}/submissions (token2)", True, f"Found {len(submissions)} submissions")
                    
                    # Vote on submission with token2
                    vote_data = {"vote_type": "approve"}
                    response = make_request("POST", f"/submissions/{submission_id}/vote", TOKEN2, vote_data)
                    if response and response.status_code == 200:
                        vote_result = response.json()
                        log_test("POST /submissions/{submission_id}/vote (token2)", True, f"Vote result: {vote_result.get('result', 'unknown')}")
                    else:
                        log_test("POST /submissions/{submission_id}/vote (token2)", False, f"Status: {response.status_code if response else 'No response'}")
                else:
                    log_test("GET /games/{game_id}/submissions (token2)", False, f"Submission not found: {submissions}")
            else:
                log_test("GET /games/{game_id}/submissions (token2)", False, f"Status: {response.status_code if response else 'No response'}")
        else:
            log_test("POST /games/{game_id}/play (token1)", False, f"No submission_id: {play_result}")
    else:
        log_test("POST /games/{game_id}/play (token1)", False, f"Status: {response.status_code if response else 'No response'}")

def run_leaderboard():
    """Test leaderboard endpoint"""
    print("\n=== TESTING LEADERBOARD ===")
    
    response = make_request("GET", "/users/leaderboard", TOKEN1)
    if response and response.status_code == 200:
        leaderboard = response.json()
        if isinstance(leaderboard, list):
            log_test("GET /users/leaderboard", True, f"Got {len(leaderboard)} users in leaderboard")
        else:
            log_test("GET /users/leaderboard", False, f"Expected list, got: {type(leaderboard)}")
    else:
        log_test("GET /users/leaderboard", False, f"Status: {response.status_code if response else 'No response'}")

def run_friends_system():
    """Test friends system (optional)"""
    print("\n=== TESTING FRIENDS SYSTEM ===")
    
    # Send friend request from token1 to token2
    friend_data = {"player_id": PLAYER_ID2}
    response = make_request("POST", "/friends/request", TOKEN1, friend_data)
    
    if response is None:
        log_test("POST /friends/request (token1 to token2)", False, "No response received")
    elif response.status_code == 200:
        request_result = response.json()
        log_test("POST /friends/request (token1 to token2)", True, f"Request ID: {request_result.get('request_id')}")
    elif response.status_code == 400:
        # This is expected if request already exists
        error_detail = response.json().get("detail", "")
        if "already sent" in error_detail.lower():
            log_test("POST /friends/request (token1 to token2)", True, f"Request already exists (expected): {error_detail}")
        else:
            log_test("POST /friends/request (token1 to token2)", False, f"Unexpected 400 error: {error_detail}")
    else:
        log_test("POST /friends/request (token1 to token2)", False, f"Unexpected status: {response.status_code}")
        
    # Get friend requests for token2
    response = make_request("GET", "/friends/requests", TOKEN2)
    if response and response.status_code == 200:
        requests_list = response.json()
        if len(requests_list) > 0:
            log_test("GET /friends/requests (token2)", True, f"Found {len(requests_list)} friend requests")
        else:
            log_test("GET /friends/requests (token2)", False, "No friend requests found")
    else:
        log_test("GET /friends/requests (token2)", False, f"Status: {response.status_code if response else 'No response'}")

def run_health_endpoints():
    """Test basic health endpoints"""
    print("\n=== TESTING HEALTH ENDPOINTS ===")
    
    # Test root endpoint
    response = make_request("GET", "/")
    if response and response.status_code == 200:
        root_data = response.json()
        if "Kartlı Challenge API" in root_data.get("message", ""):
            log_test("GET / (root)", True, f"API message: {root_data.get('message')}")
        else:
            log_test("GET / (root)", False, f"Unexpected message: {root_data}")
    else:
        log_test("GET / (root)", False, f"Status: {response.status_code if response else 'No response'}")
    
    # Test health endpoint
    response = make_request("GET", "/health")
    if response and response.status_code == 200:
        health_data = response.json()
        if health_data.get("status") == "healthy":
            log_test("GET /health", True, "API is healthy")
        else:
            log_test("GET /health", False, f"Unhealthy status: {health_data}")
    else:
        log_test("GET /health", False, f"Status: {response.status_code if response else 'No response'}")

def main():
    """Run all tests"""
    print("🎮 Kartlı Challenge Backend API Test Suite")
    print(f"🔗 Base URL: {BASE_URL}")
    print(f"🔑 Test Tokens: {TOKEN1[:20]}..., {TOKEN2[:20]}...")
    print(f"👥 Player IDs: {PLAYER_ID1}, {PLAYER_ID2}")
    
    # Run all test suites
    run_health_endpoints()
    run_auth_endpoints()
    group_id, invite_code = run_groups_system()
    game_id = run_game_system(group_id)
    card1_id, card2_id = run_card_system(game_id)
    run_play_and_vote_system(game_id, card1_id, card2_id)
    run_leaderboard()
    run_friends_system()
    
    # Print summary
    print("\n" + "="*50)
    print("📊 TEST SUMMARY")
    print("="*50)
    
    total_tests = len(test_results)
    passed_tests = len([t for t in test_results if t["success"]])
    failed_tests_count = total_tests - passed_tests
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests_count}")
    
    if failed_tests:
        print(f"\n🚨 Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    # Save detailed results
    with open("/app/test_results_detailed.json", "w") as f:
        json.dump({
            "summary": {
                "total": total_tests,
                "passed": passed_tests,
                "failed": failed_tests_count,
                "success_rate": success_rate,
                "failed_test_names": failed_tests
            },
            "details": test_results,
            "test_config": {
                "base_url": BASE_URL,
                "token1": TOKEN1,
                "token2": TOKEN2,
                "player_id1": PLAYER_ID1,
                "player_id2": PLAYER_ID2
            }
        }, f, indent=2)
    
    print(f"\n💾 Detailed results saved to: /app/test_results_detailed.json")
    
    return failed_tests_count == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)