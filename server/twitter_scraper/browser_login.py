from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import json
from configparser import ConfigParser
import sys

def login_and_save_cookies(headless=False):
    # Get credentials from config
    config = ConfigParser()
    config.read('config.ini')
    username = config['X']['username']
    email = config['X']['email']
    password = config['X']['password']
    
    print("Starting browser for Twitter login...")
    
    # Configure browser
    options = webdriver.ChromeOptions()
    # Use headless mode only if specified (default is visible browser)
    if headless:
        options.add_argument("--headless")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 30)
    
    try:
        # Go to Twitter login page
        driver.get("https://twitter.com/i/flow/login")
        print("Navigating to Twitter login page...")
        
        # Wait for login form and enter username/email
        time.sleep(5)  # Give page time to fully load
        
        print("Entering username or email...")
        username_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[autocomplete='username']")))
        username_input.send_keys(email if '@' in email else username)
        
        # Click Next
        next_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[text()='Next']")))
        next_button.click()
        
        print("Entering password...")
        # Check if unusual login detected (sometimes Twitter asks for username again)
        time.sleep(3)
        try:
            unusual_login = driver.find_element(By.XPATH, "//span[contains(text(), 'unusual login') or contains(text(), 'Enter your phone number or username')]")
            if unusual_login:
                print("Unusual login detected, entering username...")
                username_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[data-testid='ocfEnterTextTextInput']")))
                username_input.send_keys(username)
                
                next_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[text()='Next']")))
                next_button.click()
        except:
            pass
        
        # Enter password
        password_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='password']")))
        password_input.send_keys(password)
        
        # Click login
        login_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[text()='Log in']")))
        login_button.click()
        
        # Wait for successful login
        print("Waiting for successful login...")
        time.sleep(5)
        
        # Check if we need to handle 2FA
        try:
            twofa_input = driver.find_element(By.CSS_SELECTOR, "input[data-testid='ocfEnterTextTextInput']")
            if twofa_input:
                print("2FA detected. Enter the code sent to your device:")
                twofa_code = input()
                twofa_input.send_keys(twofa_code)
                
                verify_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[text()='Next']")))
                verify_button.click()
                time.sleep(5)
        except:
            pass
        
        # Final check to ensure we're logged in
        try:
            home_timeline = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "a[data-testid='AppTabBar_Home_Link']")))
            print("Successfully logged in!")
        except:
            print("Login may have failed. Please check the browser.")
            if not headless:
                input("Press Enter to continue and save cookies anyway...")
        
        # Get all cookies
        cookies = driver.get_cookies()
        
        # Save cookies for twikit
        twikit_cookies = {}
        for cookie in cookies:
            twikit_cookies[cookie['name']] = cookie['value']
        
        # Save cookies as JSON
        with open('cookies.json', 'w') as f:
            json.dump(twikit_cookies, f)
        
        print("Cookies saved to cookies.json")
        return True
    
    except Exception as e:
        print(f"Error during login: {e}")
        return False
    
    finally:
        print("Closing browser...")
        driver.quit()

if __name__ == "__main__":
    # Check if headless mode is requested via command line
    headless_mode = "--headless" in sys.argv
    login_and_save_cookies(headless=headless_mode) 