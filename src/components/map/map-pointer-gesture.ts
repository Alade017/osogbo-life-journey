/** A multi-pointer gesture remains cancelled until every pointer is released. */
export class MapPointerGesture {
  private pointers = new Set<number>();
  private origin = { x: 0, y: 0 };
  moved = false;
  down(id: number, x: number, y: number) {
    if (this.pointers.size === 0) {
      this.origin = { x, y };
      this.moved = false;
    }
    this.pointers.add(id);
    if (this.pointers.size > 1) this.moved = true;
  }
  move(x: number, y: number) {
    if (this.pointers.size && Math.hypot(x - this.origin.x, y - this.origin.y) >= 6)
      this.moved = true;
  }
  up(id: number) {
    this.pointers.delete(id);
  }
  cancel(id: number) {
    this.moved = true;
    this.up(id);
  }
  keyboard() {
    if (!this.pointers.size) this.moved = false;
  }
}
