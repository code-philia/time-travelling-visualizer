import requests
from openai import OpenAI

client = OpenAI(api_key="", base_url="")

def call_llm_agent(input):
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a helpful assistant"},
                {"role": "user", "content": input},
            ],
            max_tokens=1024,
            temperature=0.7,
            stream=False
        )

        output = response.choices[0].message.content
        return {
            "status": "success",
            "tool": "search point",
            "output": output
        }
    except Exception as e:
        return {
            "status": "error",
            "tool": "search point",
            "output": str(e)
        }