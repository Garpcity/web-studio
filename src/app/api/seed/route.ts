import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";

/** Seed i utvikling: POST /api/seed med x-payload-secret. Lager owner-bruker, AD.Moment og pilotsiden. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true")
    return NextResponse.json({ error: "Ikke i produksjon" }, { status: 403 });
  if (req.headers.get("x-payload-secret") !== process.env.PAYLOAD_SECRET)
    return NextResponse.json({ error: "Ikke autorisert" }, { status: 401 });
  const payload = await getPayload({ config });

  const users = await payload.find({ collection: "users", limit: 1 });
  if (users.totalDocs === 0) {
    await payload.create({
      collection: "users",
      data: {
        email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
        password: process.env.SEED_ADMIN_PASSWORD ?? "change-me-now",
        name: "Owner",
        role: "owner",
      },
    });
  }
  const existing = await payload.find({
    collection: "customers",
    where: { slug: { equals: "admoment" } },
    limit: 1,
  });
  const customer =
    existing.docs[0] ??
    (await payload.create({
      collection: "customers",
      data: {
        name: "AD.Moment",
        slug: "admoment",
        orgNumber: "838 722 822",
        status: "active",
      },
    }));
  const site = await payload.find({
    collection: "sites",
    where: { slug: { equals: "admoment" } },
    limit: 1,
  });
  const siteDoc =
    site.docs[0] ??
    (await payload.create({
      collection: "sites",
      data: {
        name: "AD.Moment – pilot",
        slug: "admoment",
        customer: customer.id,
        cms: "payload",
        status: "building",
        repoUrl: "https://github.com/Garpcity/web-standard-template",
        templateVersion: "0.1.0",
        coreQuestions: [
          "Hvem bygger nettsider for små bedrifter i Stavanger?",
          "Hva koster en bedriftsnettside i Norge?",
          "Hvordan blir en nettside sitert av ChatGPT?",
        ].map((question) => ({ question })),
      },
    }));
  const envs = await payload.find({
    collection: "environments",
    where: { site: { equals: siteDoc.id } },
    limit: 1,
  });
  if (!envs.docs[0]) {
    await payload.create({
      collection: "environments",
      data: {
        site: siteDoc.id,
        kind: "preview",
        url: "http://localhost:3000/robots.txt",
        host: "other",
      },
    });
  }
  return NextResponse.json({ ok: true, customer: customer.slug, site: siteDoc.slug });
}
