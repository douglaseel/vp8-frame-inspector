

export function getBitsMask (n: number) : number {
  return (( 1 <<(n)) - 1)
}

export function getBits (val: number, bit: number, len: number) : number { 
  return (((val)>>(bit)) & getBitsMask(len))
}