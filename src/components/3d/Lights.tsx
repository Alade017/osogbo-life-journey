export function Lights() {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight position={[8, 16, 6]} intensity={2} />
    </>
  );
}
