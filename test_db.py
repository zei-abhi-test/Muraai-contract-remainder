import psycopg2

conn = psycopg2.connect(
    host="localhost",
    port=5001,
    database="muraai_contracts",
    user="postgres",
    password="abhi$2594"
)

print("Connected Successfully!")

conn.close()