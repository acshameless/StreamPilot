import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "无效的表单数据" }, { status: 400 });
  }

  const file = formData.get("file");
  const accountId = String(formData.get("accountId") ?? "");
  const accessKeyId = String(formData.get("accessKeyId") ?? "");
  const secretAccessKey = String(formData.get("secretAccessKey") ?? "");
  const bucket = String(formData.get("bucket") ?? "");
  const publicUrl = String(formData.get("publicUrl") ?? "");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "缺少文件" }, { status: 400 });
  }
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return Response.json({ error: "缺少 R2 配置" }, { status: 400 });
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const ext = file.name.split(".").pop() || "jpg";
  const key = `sku/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || "image/jpeg",
      }),
    );

    const url = publicUrl
      ? `${publicUrl.replace(/\/$/, "")}/${key}`
      : `${endpoint}/${bucket}/${key}`;

    return Response.json({ url, key });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "上传失败";
    return Response.json({ error: msg }, { status: 502 });
  }
}
