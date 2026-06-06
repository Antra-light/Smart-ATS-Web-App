"""Standalone SMTP diagnostic. Run:  python email_diagnose.py [recipient@email.com]
Shows the raw Gmail conversation and the FULL error if sending fails."""
import os, sys, ssl, smtplib, traceback
from email.message import EmailMessage
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("SMTP_HOST")
port = int(os.getenv("SMTP_PORT") or 587)
user = os.getenv("SMTP_USER")
raw_pass = os.getenv("SMTP_PASS") or ""
password = raw_pass.replace(" ", "")
sender = os.getenv("SMTP_FROM") or user
recipient = sys.argv[1] if len(sys.argv) > 1 else user

print("HOST:", host, "PORT:", port)
print("USER:", user)
print("PASS length (spaces stripped):", len(password), "| chars look valid:",
      password.isalnum())
print("FROM:", sender)
print("RECIPIENT:", recipient)
print("-" * 60)

msg = EmailMessage()
msg["Subject"] = "Smart ATS — SMTP diagnostic test"
msg["From"] = sender
msg["To"] = recipient
msg.set_content("If you can read this, SMTP delivery is working. Code: 999111")

try:
    with smtplib.SMTP(host, port, timeout=20) as server:
        server.set_debuglevel(1)              # print the full SMTP conversation
        server.ehlo()
        server.starttls(context=ssl.create_default_context())
        server.ehlo()
        server.login(user, password)
        server.send_message(msg, from_addr=sender, to_addrs=[recipient])
    print("-" * 60)
    print("RESULT: SUCCESS — Gmail accepted the message for", recipient)
except Exception as e:
    print("-" * 60)
    print("RESULT: FAILED")
    print("ERROR TYPE:", type(e).__name__)
    print("ERROR:", e)
    traceback.print_exc()
