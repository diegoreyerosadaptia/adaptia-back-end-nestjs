import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne
  } from 'typeorm';

@Entity('sasb_list_contents')
export class SasbListContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable:true})
  industria: string;

  @Column({nullable:true})
  descripcion_industria: string;

  @Column({nullable:true})
  tema: string;

  @Column({nullable:true})
  parametro_contabilidad: string;

  @Column({nullable:true})
  categoria: string;

  @Column({nullable:true})
  unidad_medida: string;

  @Column({nullable:true})
  codigo: string;

}
