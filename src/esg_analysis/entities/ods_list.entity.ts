import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
  } from 'typeorm';

@Entity('ods_list')
export class OdsList {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({nullable:true})
  ods: string;

  @Column({nullable:true})
  meta: string;

  @Column({nullable:true})
  indicador: string;
}
