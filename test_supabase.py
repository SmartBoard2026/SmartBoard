from supabase import create_client, Client

URL = "https://gdiaotelevhqmesamrnx.supabase.co"
KEY = "sb_publishable_GmMBanAw-lgoZkJBFDK2NA_zX6CLwZ0"

supabase: Client = create_client(URL, KEY)

try:
    print("Testing 'games' table...")
    response = supabase.table("games").select("*").execute()
    print(f"Total games found: {len(response.data)}")
    for g in response.data:
        print(f"ID: {g['id']}, Title: {g['title']}, Status: {g['status']}")

    print("\nTesting 'in_progress' filter...")
    response = supabase.table("games").select("*").eq("status", "in_progress").execute()
    print(f"Ongoing games found: {len(response.data)}")
except Exception as e:
    print(f"Error: {e}")
