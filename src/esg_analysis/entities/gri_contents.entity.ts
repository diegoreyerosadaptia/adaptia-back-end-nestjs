import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';

@Entity('gri_contents')
export class GriContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable:true})
  tema: string;

  @Column({nullable:true})
  estandar_gri: string;

  @Column({nullable:true})
  numero_contenido: string;

  @Column({nullable:true})
  contenido: string;

  @Column({nullable:true})
  requerimiento: string;
}
