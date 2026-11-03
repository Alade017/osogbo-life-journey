import type { HousePlacement, HouseSlot } from '@/components/game/housing/HouseRoomScene';
import { housePartitionSegments, houseSlotPosition, roomPercentToPosition } from '@/components/game/housing/house-room-contract';
export type RoomPoint = [number, number, number];
export type RoomObstacle = {x:number;z:number;w:number;d:number};
export function placementPoint(item:HousePlacement, slots:HouseSlot[], width:number,depth:number):RoomPoint {
 if (item.x !== undefined && item.y !== undefined) return roomPercentToPosition(item.x,item.y,width,depth);
 const slot=slots.find(s=>s.id===item.slot); return slot?houseSlotPosition(slot,width,depth):[0,.06,0];
}
export function packagePoint(index:number,width:number,depth:number):RoomPoint {
 return [width*.22+index*.56,.06,-depth/2+.72+(index%2)*.46];
}
export function roomObstacles(type:string,width:number,depth:number,placements:HousePlacement[],slots:HouseSlot[]):RoomObstacle[] {
 return [...housePartitionSegments(type,width,depth).map(s=>({x:s.position[0],z:s.position[2],w:s.size[0],d:s.size[2]})),
 ...placements.map(p=>{const point=placementPoint(p,slots,width,depth);
 const [w,d]=p.slot_type==='bed'?[1.45,2.1]:p.slot_type==='sofa'?[1.8,.85]:p.slot_type==='plant'?[.45,.45]:[.8,.75];
 return {x:point[0],z:point[2],w:w!,d:d!};})];
}
/** Four-way grid search: diagonal shortcuts cannot clip furniture or doorway corners. */
export function findRoomPath(start:RoomPoint,target:RoomPoint,width:number,depth:number,obstacles:RoomObstacle[],interact=false):RoomPoint[] | null {
 if (![...start,...target,width,depth].every(Number.isFinite)) return null;
 const step=.2, margin=.3, cols=Math.floor((width-2*margin)/step)+1, rows=Math.floor((depth-2*margin)/step)+1;
 const point=(i:number):RoomPoint=>[-width/2+margin+(i%cols)*step,.06,-depth/2+margin+Math.floor(i/cols)*step];
 const blocked=(i:number)=>{const [x,,z]=point(i);return obstacles.some(o=>Math.abs(x-o.x)<o.w/2+.2&&Math.abs(z-o.z)<o.d/2+.2);};
 const nearest=(p:RoomPoint)=>{let best=-1,distance=Infinity;for(let i=0;i<cols*rows;i++){if(blocked(i))continue;const q=point(i),d=Math.hypot(q[0]-p[0],q[2]-p[2]);if(d<distance){best=i;distance=d;}}return best;};
 if (!interact && (Math.abs(target[0])>width/2-margin || Math.abs(target[2])>depth/2-margin)) return null;
 const origin=nearest(start); if(origin<0)return null;
 // Search reachable space first, then choose the nearest reachable interaction spot.
 const queue=[origin], parents=new Map<number,number>([[origin,-1]]);let cursor=0;
 while(cursor<queue.length){const current=queue[cursor++]!;const col=current%cols,row=Math.floor(current/cols);
 for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){const c=col+dc!,r=row+dr!;if(c<0||r<0||c>=cols||r>=rows)continue;const next=r*cols+c;if(parents.has(next)||blocked(next))continue;parents.set(next,current);queue.push(next);}}
 let end=-1,distance=Infinity;for(const i of queue){const p=point(i),d=Math.hypot(p[0]-target[0],p[2]-target[2]);if(d<distance){end=i;distance=d;}}
 if(end<0 || (!interact&&distance>.35) || (interact&&distance>1.65))return null;
 const path:RoomPoint[]=[];for(let i=end;i!==-1;i=parents.get(i)??-1)path.unshift(point(i));
 // Start positions are maintained on navigable cells. Snap only when a layout change displaced the actor.
 return path;
}
