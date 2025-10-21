import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    OneToMany,
    DeleteDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { User } from 'src/users/entities/user.entity';
import { Analysis } from 'src/analysis/entities/analysis.entity';

  export const EMPLYEES_NUMBER = [
    '1-9',
    '10-99',
    '100-499',
    '500-1000',
    '1000-5000',
    '5000-10000',
    '+10000',] as const;
export type EmployeesNumber = (typeof EMPLYEES_NUMBER)[number];
  
  @Entity({ name: 'organzations' })
  export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ nullable: false })
    name: string;
  
    @Column({ nullable: false })
    lastName: string;
  
    @Column({ nullable: false })
    company: string;
  
    @Column({ nullable: false })
    industry: string;

    @Column('enum', { enum: EMPLYEES_NUMBER, default: EMPLYEES_NUMBER[0] })
    employees_number: EmployeesNumber;
  
    @Column({ nullable: true })
    phone: string;
  
    @Column({ nullable: false })
    country: string;
  
    @Column({ nullable: false })
    website: string;
  
    @Column({ nullable: true })
    document: string;
  
    @Column({ type: 'uuid' , nullable: true})
    owner_id: string;

    @ManyToOne(() => User, (user) => user.organizations, {
      onDelete: 'CASCADE', nullable: true
    })
    owner: User;
  
    @OneToMany(() => Analysis, (analysis) => analysis.organization, {
      cascade: true,
    })
    analysis: Analysis[];

    @DeleteDateColumn()
    deletedAt: Date;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  }
  