import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('layer')
export class LayerEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'json' })
  layer_info: Record<string, any>;
}
