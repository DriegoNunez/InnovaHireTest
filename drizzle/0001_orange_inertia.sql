CREATE TABLE "figures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"data" "bytea" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "figure_id" uuid;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "figure_alt" text;--> statement-breakpoint
ALTER TABLE "figures" ADD CONSTRAINT "figures_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_figure_id_figures_id_fk" FOREIGN KEY ("figure_id") REFERENCES "public"."figures"("id") ON DELETE no action ON UPDATE no action;