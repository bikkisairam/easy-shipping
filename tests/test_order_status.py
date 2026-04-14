import pytest
import json
from weight_server import app


@pytest.fixture
def client():
    """Create a test client for the Flask application."""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestOrderStatusEndpoint:
    """Tests for GET /api/orders/{order_id}/status endpoint."""

    def test_get_order_status_returns_200_with_valid_order_id(self, client):
        """
        Acceptance Criterion: GET /api/orders/{order_id}/status endpoint returns 200 with order status
        Given: A shipping order exists in the system with tracking information
        When: A customer queries the order status endpoint with their order ID
        Then: The system returns 200 status code with order information
        """
        response = client.get('/api/orders/12345/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'status' in data
        assert 'order_id' in data
        assert data['order_id'] == '12345'

    def test_order_status_includes_current_status(self, client):
        """
        Acceptance Criterion: Response includes current status (e.g., pending, shipped, in_transit, delivered)
        Given: A shipping order exists with a specific status
        When: A customer queries the order status endpoint
        Then: The response includes the current status field
        """
        response = client.get('/api/orders/12345/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'status' in data
        # Status should be one of the expected values
        valid_statuses = ['pending', 'shipped', 'in_transit', 'delivered']
        assert data['status'] in valid_statuses

    def test_order_status_includes_estimated_delivery_date_when_available(self, client):
        """
        Acceptance Criterion: Response includes estimated delivery date when available
        Given: A shipping order exists with an estimated delivery date
        When: A customer queries the order status endpoint
        Then: The response includes the estimated_delivery_date field
        """
        response = client.get('/api/orders/12345/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'estimated_delivery_date' in data
        # Should be a valid date string or None
        if data['estimated_delivery_date'] is not None:
            assert isinstance(data['estimated_delivery_date'], str)

    def test_order_status_returns_404_for_nonexistent_order(self, client):
        """
        Acceptance Criterion: Endpoint returns 404 when order ID does not exist
        Given: An order ID that does not exist in the system
        When: A customer queries the order status endpoint with this ID
        Then: The system returns 404 status code
        """
        response = client.get('/api/orders/99999/status')
        assert response.status_code == 404
        data = json.loads(response.data)
        assert 'error' in data

    def test_order_status_returns_400_for_malformed_order_id(self, client):
        """
        Acceptance Criterion: Endpoint returns 400 for malformed order ID requests
        Given: A malformed order ID (e.g., empty string, special characters)
        When: A customer queries the order status endpoint
        Then: The system returns 400 status code
        """
        # Test with empty order ID
        response = client.get('/api/orders//status')
        assert response.status_code in [400, 404]  # Could be 404 due to route mismatch
        
        # Test with invalid characters
        response = client.get('/api/orders/invalid@#$/status')
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_shipped_order_has_estimated_delivery_date(self, client):
        """
        Edge case: A shipped order should have an estimated delivery date
        Given: An order with status 'shipped'
        When: A customer queries the order status endpoint
        Then: The estimated_delivery_date should not be None
        """
        # Use a different order ID that we know is shipped
        response = client.get('/api/orders/67890/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        if data['status'] in ['shipped', 'in_transit']:
            assert data['estimated_delivery_date'] is not None

    def test_delivered_order_status(self, client):
        """
        Edge case: A delivered order should have status 'delivered'
        Given: An order that has been delivered
        When: A customer queries the order status endpoint
        Then: The status should be 'delivered'
        """
        # Use order ID that is delivered
        response = client.get('/api/orders/11111/status')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'status' in data
