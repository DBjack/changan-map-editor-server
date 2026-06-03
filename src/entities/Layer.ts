import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Layer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'array', array: true, default: '[]' })
  layerList: string[];
}
