#!/usr/bin/env python3
"""
Pytest configuration and fixtures for Kartlı Challenge tests
"""

import pytest
import sys
import os

# Add the current directory to path
sys.path.insert(0, os.path.dirname(__file__))


def pytest_configure(config):
    """Initialize test configuration"""
    # Run initial tests to get IDs for later tests
    pass


@pytest.fixture(scope="module")
def group_id_fixture():
    """Create and return group_id using helper function"""
    from backend_test import run_groups_system
    group_id, _ = run_groups_system()
    return group_id


@pytest.fixture(scope="module")
def game_id_fixture(group_id_fixture):
    """Create and return game_id using helper function"""
    from backend_test import run_game_system
    if not group_id_fixture:
        pytest.skip("group_id not available")
    game_id = run_game_system(group_id_fixture)
    return game_id


@pytest.fixture(scope="module")
def card_ids_fixture(game_id_fixture):
    """Get card IDs using helper function"""
    from backend_test import run_card_system
    if not game_id_fixture:
        pytest.skip("game_id not available")
    card1_id, card2_id = run_card_system(game_id_fixture)
    return card1_id, card2_id


@pytest.fixture(scope="module")
def card1_id_fixture(card_ids_fixture):
    """Get card1_id from card_ids"""
    return card_ids_fixture[0]


@pytest.fixture(scope="module")
def card2_id_fixture(card_ids_fixture):
    """Get card2_id from card_ids"""
    return card_ids_fixture[1]
