import ZipCodeMap from "../zip_codes";

export default function Page() {
  return (
    <main style={{ padding: "24px 16px" }}>
      <h1
        style={{
          maxWidth: 1180,
          margin: "0 auto 16px",
          fontSize: 22,
          fontWeight: 600,
        }}
      >
        Service Zone Builder
      </h1>
      <ZipCodeMap />
    </main>
  );
}
