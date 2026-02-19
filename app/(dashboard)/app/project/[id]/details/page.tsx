"use client";

import { createClient } from "@/lib/supabase/client";
import type { Project } from "@/lib/types";
import {
  ArrowRight,
  Building2,
  Loader2,
  Save,
  User,
} from "lucide-react";
import { motion } from "motion/react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

export default function DetailsPage(): ReactNode {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    price: "",
    beds: "",
    baths: "",
    sqft: "",
    highlights: "",
    agent_name: "",
    agent_phone: "",
    brokerage: "",
  });

  const loadProject = useCallback(async () => {
    const { data } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (data) {
      const p = data as Project;
      setForm({
        title: p.title ?? "",
        address: p.address ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
        zip: p.zip ?? "",
        price: p.price?.toString() ?? "",
        beds: p.beds?.toString() ?? "",
        baths: p.baths?.toString() ?? "",
        sqft: p.sqft?.toString() ?? "",
        highlights: p.highlights ?? "",
        agent_name: p.agent_name ?? "",
        agent_phone: p.agent_phone ?? "",
        brokerage: p.brokerage ?? "",
      });
    }
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("projects")
      .update({
        title: form.title || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip: form.zip || null,
        price: form.price ? Number(form.price) : null,
        beds: form.beds ? Number(form.beds) : null,
        baths: form.baths ? Number(form.baths) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        highlights: form.highlights || null,
        agent_name: form.agent_name || null,
        agent_phone: form.agent_phone || null,
        brokerage: form.brokerage || null,
        status: "details_ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);

    setSaving(false);
  };

  const handleContinue = async () => {
    await handleSave({ preventDefault: () => {} } as FormEvent);
    router.push(`/app/project/${projectId}/results`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const inputClass =
    "w-full px-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow text-sm";

  return (
    <div className="flex gap-6 h-full p-4 md:p-6 lg:p-8">
      {/* Left Panel — Form */}
      <div className="flex-1 min-w-0 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-1">
            Listing Details
          </h1>
          <p className="text-neutral-500 text-sm mb-6">
            Add property information for captions and overlays.
          </p>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Property Info */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-neutral-700">
                  Property Information
                </h3>
              </div>

              <div>
                <label htmlFor="title" className="block text-xs font-medium text-neutral-600 mb-1">
                  Project Title
                </label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="e.g., Modern Luxury in Beverly Hills"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="address" className="block text-xs font-medium text-neutral-600 mb-1">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  placeholder="123 Main Street"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="city" className="block text-xs font-medium text-neutral-600 mb-1">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    placeholder="City"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-xs font-medium text-neutral-600 mb-1">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={form.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    placeholder="CA"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="block text-xs font-medium text-neutral-600 mb-1">
                    ZIP
                  </label>
                  <input
                    id="zip"
                    type="text"
                    value={form.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder="90210"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="price" className="block text-xs font-medium text-neutral-600 mb-1">
                    Price
                  </label>
                  <input
                    id="price"
                    type="number"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    placeholder="750000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="beds" className="block text-xs font-medium text-neutral-600 mb-1">
                    Beds
                  </label>
                  <input
                    id="beds"
                    type="number"
                    value={form.beds}
                    onChange={(e) => updateField("beds", e.target.value)}
                    placeholder="4"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="baths" className="block text-xs font-medium text-neutral-600 mb-1">
                    Baths
                  </label>
                  <input
                    id="baths"
                    type="number"
                    value={form.baths}
                    onChange={(e) => updateField("baths", e.target.value)}
                    placeholder="3"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="sqft" className="block text-xs font-medium text-neutral-600 mb-1">
                    Sq Ft
                  </label>
                  <input
                    id="sqft"
                    type="number"
                    value={form.sqft}
                    onChange={(e) => updateField("sqft", e.target.value)}
                    placeholder="2500"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="highlights" className="block text-xs font-medium text-neutral-600 mb-1">
                  Highlights
                </label>
                <textarea
                  id="highlights"
                  value={form.highlights}
                  onChange={(e) => updateField("highlights", e.target.value)}
                  placeholder="Key features, recent renovations, unique selling points..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Agent Info */}
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <User className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-neutral-700">
                  Agent Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="agent_name" className="block text-xs font-medium text-neutral-600 mb-1">
                    Agent Name
                  </label>
                  <input
                    id="agent_name"
                    type="text"
                    value={form.agent_name}
                    onChange={(e) => updateField("agent_name", e.target.value)}
                    placeholder="Jane Smith"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="agent_phone" className="block text-xs font-medium text-neutral-600 mb-1">
                    Phone
                  </label>
                  <input
                    id="agent_phone"
                    type="tel"
                    value={form.agent_phone}
                    onChange={(e) => updateField("agent_phone", e.target.value)}
                    placeholder="(555) 123-4567"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="brokerage" className="block text-xs font-medium text-neutral-600 mb-1">
                  Brokerage
                </label>
                <input
                  id="brokerage"
                  type="text"
                  value={form.brokerage}
                  onChange={(e) => updateField("brokerage", e.target.value)}
                  placeholder="Compass Real Estate"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </button>
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
              >
                Save & View Results
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Right Panel — Preview Summary */}
      <div className="hidden lg:flex w-[40%] shrink-0 bg-neutral-100 rounded-2xl items-center justify-center overflow-hidden p-6">
        <div className="text-center max-w-xs">
          <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-neutral-700 mb-2">
            {form.title || "Your Listing"}
          </h3>
          {form.address && (
            <p className="text-xs text-neutral-500 mb-3">
              {form.address}
              {form.city ? `, ${form.city}` : ""}
              {form.state ? ` ${form.state}` : ""}
              {form.zip ? ` ${form.zip}` : ""}
            </p>
          )}
          {(form.beds || form.baths || form.sqft) && (
            <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
              {form.beds && <span>{form.beds} bed</span>}
              {form.baths && <span>{form.baths} bath</span>}
              {form.sqft && <span>{Number(form.sqft).toLocaleString()} sqft</span>}
            </div>
          )}
          {form.price && (
            <p className="text-lg font-semibold text-neutral-800 mt-3">
              ${Number(form.price).toLocaleString()}
            </p>
          )}
          {form.agent_name && (
            <p className="text-xs text-neutral-400 mt-4">
              {form.agent_name}
              {form.brokerage ? ` — ${form.brokerage}` : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
