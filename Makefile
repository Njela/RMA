.PHONY: up down seed test dev-backend dev-frontend demo

up:            ## run the full stack (Postgres, Redis, API, worker, beat, web)
	docker compose up --build
down:
	docker compose down
seed:          ## load sample serial numbers into the running stack
	docker compose exec backend python -m app.seed
test:          ## backend tests (no Docker, SQLite in memory)
	cd backend && pip install -q -r requirements-dev.txt && python -m pytest -q
dev-backend:   ## API only, SQLite, pipeline runs in-process (no Redis/Celery needed)
	cd backend && python -m app.seed && PIPELINE_MODE=inline python -m uvicorn app.main:app --reload --port 8000
dev-frontend:
	cd frontend && npm install && npm run dev
demo:          ## walk one claim through the flow against a running API
	./scripts/demo.sh
