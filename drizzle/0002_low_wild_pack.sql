-- Question figures and AI grading trace IDs. Written to be safe on databases that already
-- have these objects from the branch's earlier migrations (0001_orange_inertia and
-- 0002_breezy_crystal before the merge with 0001_enable_rls).
CREATE TABLE IF NOT EXISTS "figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "figures" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "grades" ADD COLUMN IF NOT EXISTS "ai_response_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "figure_id" uuid;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "figure_alt" text;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "figures" ADD CONSTRAINT "figures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "questions" ADD CONSTRAINT "questions_figure_id_figures_id_fk" FOREIGN KEY ("figure_id") REFERENCES "public"."figures"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
