import logging
import requests
from app.utils.config import get_settings

logger = logging.getLogger(__name__)

def send_emergency_sms(phone_number: str, message: str) -> str:
    """
    Sends an SMS using TextBee.
    Returns the status: 'SMS_SENT', 'SMS_FAILED', or 'SMS_NOT_CONFIGURED'
    """
    settings = get_settings()
    
    if settings.SMS_PROVIDER.lower() != "textbee" or not settings.TEXTBEE_API_KEY:
        logger.info("TextBee SMS service is not configured (missing API key or provider not set to textbee).")
        return "SMS_NOT_CONFIGURED"
        
    logger.info("TextBee SMS request started")
    
    headers = {
        "x-api-key": settings.TEXTBEE_API_KEY,
        "Content-Type": "application/json"
    }
    
    payload = {
        "recipients": [phone_number],
        "message": message
    }
    
    if settings.TEXTBEE_DEVICE_ID:
        payload["deviceId"] = settings.TEXTBEE_DEVICE_ID
        
    try:
        response = requests.post(
            settings.TEXTBEE_BASE_URL,
            json=payload,
            headers=headers,
            timeout=15
        )
        response.raise_for_status()
        logger.info("TextBee SMS request successful")
        return "SMS_SENT"
    except requests.exceptions.RequestException as e:
        # Avoid logging the full request object if it contains headers with the API key
        status_code = getattr(e.response, "status_code", "Unknown")
        reason = getattr(e.response, "reason", "Unknown")
        # Attempt to get response body for detailed error, if available
        resp_body = ""
        if hasattr(e.response, "text") and e.response.text:
            resp_body = f" - Body: {e.response.text[:200]}"
            
        logger.error(f"TextBee SMS request failed: HTTP {status_code} - {reason}{resp_body}. Error: {str(e)}")
        return "SMS_FAILED"
    except Exception as e:
        logger.error(f"TextBee SMS request failed with unexpected error: {type(e).__name__} - {str(e)}")
        return "SMS_FAILED"
