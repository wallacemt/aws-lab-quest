import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { ADMIN_TOOL_CATALOG } from "@/features/mcp/server/catalog";
import { CONTENT_TOOLS } from "@/features/mcp/server/catalog/content";
import { EMAIL_TOOLS } from "@/features/mcp/server/catalog/email";
import { OPS_TOOLS } from "@/features/mcp/server/catalog/ops";

describe("MCP content, email and ops catalogs", () => {
  it("has unique names and exactly the specified tools", () => {
    const names=ADMIN_TOOL_CATALOG.map(t=>t.name);
    expect(names.length).toBe(new Set(names).size);
    expect(CONTENT_TOOLS.map(t=>t.name)).toEqual(["trails_list","trail_stages_list","trail_create","trail_update","trail_suggest","trail_stage_create","trail_stage_update","trail_delete","trail_stage_delete","certifications_list","certification_get","certification_create","certification_update","library_list","library_get","library_create","library_update","library_delete","changelog_list","changelog_update","changelog_entries_add","changelog_entries_remove","changelog_sync","changelog_delete","news_sources_list","news_source_create","news_source_update","news_source_delete","home_config_get","home_config_update"]);
    expect(EMAIL_TOOLS.map(t=>t.name)).toEqual(["email_templates_list","email_scheduled_list","behavioral_email_get","email_template_create","email_template_update","email_scheduled_cancel","behavioral_email_update","email_template_delete","email_send","behavioral_email_trigger"]);
    expect(OPS_TOOLS.map(t=>t.name)).toEqual(["worker_status","worker_questions","scheduled_jobs_list","system_status","system_health","config_get","ai_config_get","ai_models_openrouter","ai_models_pollinations","worker_trigger","scheduled_job_create","scheduled_job_update","ai_config_set_model","ai_benchmark","config_set_auto_approve"]);
    expect(ADMIN_TOOL_CATALOG.map(t=>t.path)).not.toContain("library/[contentId]/upload");
    expect(ADMIN_TOOL_CATALOG.some(t=>t.path==="ai-config" && t.method==="PATCH" && t.name!=="ai_config_set_model")).toBe(false);
    expect(EMAIL_TOOLS.find(t=>t.name==="email_send")?.tier).toBe("danger");
    expect(OPS_TOOLS.find(t=>t.name==="config_set_auto_approve")?.tier).toBe("danger");
  });
  it("uses strict schemas and excludes AI key updates",()=>{
    expect(CONTENT_TOOLS.find(t=>t.name==="trail_create")!.inputSchema.safeParse({name:"x",extra:1}).success).toBe(false);
    expect(EMAIL_TOOLS.find(t=>t.name==="email_send")!.inputSchema.safeParse({targetMode:"all-users",wat:1}).success).toBe(false);
    const model=OPS_TOOLS.find(t=>t.name==="ai_config_set_model")!;
    expect(model.inputSchema.safeParse({type:"key",key:"sk-secret"}).success).toBe(false);
    expect(model.inputSchema.safeParse({type:"model",context:"QUESTION_GENERATION",model:"example"}).success).toBe(true);
    expect(OPS_TOOLS.find(t=>t.name==="config_set_auto_approve")!.inputSchema.safeParse({autoApproveUsers:true,anything:1}).success).toBe(false);
  });
  it("resolves all lazy route handlers",async()=>{
    process.env.DATABASE_URL??="postgresql://test:test@localhost:5432/test";
    process.env.SUPABASE_URL??="https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY??="test-service-role-key";
    process.env.REDIS_URL??="redis://localhost:6379";
    process.env.OPENROUTER_API_KEY??="test-openrouter-key";
    for(const catalog of [CONTENT_TOOLS,EMAIL_TOOLS,OPS_TOOLS]) for(const tool of catalog) expect(typeof await tool.handler()).toBe("function");
  },90000);
});
